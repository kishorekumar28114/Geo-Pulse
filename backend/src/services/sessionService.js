const SessionConfig = require('../models/SessionConfig');
const SessionInstance = require('../models/SessionInstance');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Room = require('../models/Room');
const { DEFAULT_SESSIONS, TIMEZONE } = require('../config/constants');
const { parseIstDateTime, getIstDateStr } = require('../utils/geoAndDate');

/**
 * Initializes default session configs if none exist in the database
 */
async function ensureDefaultSessionConfigs() {
  for (const key of ['morning', 'evening']) {
    const existing = await SessionConfig.findOne({ session: key });
    if (!existing) {
      await SessionConfig.create(DEFAULT_SESSIONS[key]);
      console.log(`Default session config created for ${key}`);
    }
  }
}

/**
 * Retrieves configuration for a given session name ('morning' | 'evening')
 */
async function getSessionConfig(sessionName) {
  let config = await SessionConfig.findOne({ session: sessionName });
  if (!config) {
    config = DEFAULT_SESSIONS[sessionName] || DEFAULT_SESSIONS.morning;
  }
  return config;
}

/**
 * Finds or creates a SessionInstance for a given date and session name.
 * Roster snapshot is captured at creation to preserve historical room assignments.
 */
async function getOrCreateSessionInstance(dateStr, sessionName) {
  let instance = await SessionInstance.findOne({ date: dateStr, session: sessionName });
  if (instance) {
    // Dynamically update status if active/grace and time changed
    const now = new Date();
    if (instance.lifecycleStatus !== 'finalized' && instance.lifecycleStatus !== 'processing') {
      if (now < instance.startTime) {
        if (instance.lifecycleStatus !== 'not-started') {
          instance.lifecycleStatus = 'not-started';
          await instance.save();
        }
      } else if (now >= instance.startTime && now <= instance.endTime) {
        if (instance.lifecycleStatus !== 'active') {
          instance.lifecycleStatus = 'active';
          await instance.save();
        }
      } else if (now > instance.endTime && now <= instance.deadline) {
        if (instance.lifecycleStatus !== 'grace-period') {
          instance.lifecycleStatus = 'grace-period';
          await instance.save();
        }
      } else if (now > instance.deadline) {
        // Ready for finalization
      }
    }
    return instance;
  }

  // Need to create new instance
  const config = await getSessionConfig(sessionName);
  const startTime = parseIstDateTime(dateStr, config.startTime);
  const endTime = parseIstDateTime(dateStr, config.endTime);
  const deadline = new Date(endTime.getTime() + (config.gracePeriodMinutes || 15) * 60 * 1000);

  // Build eligible student roster snapshot
  const activeStudents = await User.find({ isAdmin: { $ne: true }, isActive: { $ne: false } }).populate('roomId');
  const roster = activeStudents.map((s) => ({
    studentId: s._id,
    rollnumber: s.rollnumber || (s.email ? s.email.split('@')[0] : `stu_${s._id.toString().slice(-6)}`),
    name: s.name || s.username || 'Hostel Student',
    roomId: s.roomId?._id || null,
    roomNumber: s.roomId?.roomNumber || s.roomno || 'Unassigned',
    floor: s.roomId?.floor || '1',
  }));

  const now = new Date();
  let initialStatus = 'not-started';
  if (now >= startTime && now <= endTime) initialStatus = 'active';
  else if (now > endTime && now <= deadline) initialStatus = 'grace-period';
  else if (now > deadline) initialStatus = 'processing';

  try {
    instance = await SessionInstance.create({
      date: dateStr,
      session: sessionName,
      startTime,
      endTime,
      deadline,
      lifecycleStatus: initialStatus,
      roster,
    });
    return instance;
  } catch (err) {
    // If concurrent insert occurred, retrieve it
    if (err.code === 11000) {
      return await SessionInstance.findOne({ date: dateStr, session: sessionName });
    }
    throw err;
  }
}

/**
 * Processes absences when the session deadline has elapsed.
 * Safe to retry, never overwrites present records, avoids duplicates.
 */
async function processSessionAbsentees(sessionInstance) {
  if (!sessionInstance) return;
  if (sessionInstance.lifecycleStatus === 'finalized') return;

  const now = new Date();
  // Never mark absent before the deadline
  if (now < sessionInstance.deadline) {
    return;
  }

  // Atomically update lifecycleStatus to 'processing'
  const lockedInstance = await SessionInstance.findOneAndUpdate(
    { _id: sessionInstance._id, lifecycleStatus: { $ne: 'finalized' } },
    { $set: { lifecycleStatus: 'processing' } },
    { new: true }
  );

  if (!lockedInstance) return;

  const roster = lockedInstance.roster || [];
  for (const student of roster) {
    try {
      // Find existing authoritative record
      const existing = await Attendance.findOne({
        studentId: student.studentId,
        date: lockedInstance.date,
        session: lockedInstance.session,
      });

      if (!existing) {
        // Safe upsert that only inserts if no document matches
        await Attendance.findOneAndUpdate(
          {
            studentId: student.studentId,
            date: lockedInstance.date,
            session: lockedInstance.session,
          },
          {
            $setOnInsert: {
              studentId: student.studentId,
              sessionInstanceId: lockedInstance._id,
              date: lockedInstance.date,
              session: lockedInstance.session,
              status: 'absent',
              source: 'scheduler',
              timestamp: lockedInstance.deadline.getTime(),
              latitude: 0,
              longitude: 0,
              distanceMeters: 0,
              imageUrl: null,
            },
          },
          { upsert: true, new: false }
        );
      }
    } catch (err) {
      // Ignore duplicate key error on concurrent write
      if (err.code !== 11000) {
        console.error(`Error finalizing absence for ${student.rollnumber}:`, err.message);
      }
    }
  }

  // Mark finalized
  lockedInstance.lifecycleStatus = 'finalized';
  await lockedInstance.save();
  console.log(`Session ${lockedInstance.date} (${lockedInstance.session}) finalized.`);
}

/**
 * Derives student user-facing status for a session:
 * 'present', 'absent', 'waiting', 'not-started', 'processing'
 */
function deriveStudentStatus(attendanceRecord, sessionInstance) {
  if (attendanceRecord) {
    return attendanceRecord.status; // 'present' or 'absent'
  }

  if (!sessionInstance) return 'not-started';

  const now = new Date();
  if (now < sessionInstance.startTime) {
    return 'not-started';
  }
  if (now <= sessionInstance.deadline) {
    return 'waiting';
  }
  // Past deadline without record
  if (sessionInstance.lifecycleStatus === 'finalized') {
    return 'absent';
  }
  return 'processing';
}

module.exports = {
  ensureDefaultSessionConfigs,
  getSessionConfig,
  getOrCreateSessionInstance,
  processSessionAbsentees,
  deriveStudentStatus,
};
