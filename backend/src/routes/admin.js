const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { adminOnly } = require('../middleware/auth');
const User = require('../models/User');
const Room = require('../models/Room');
const Attendance = require('../models/Attendance');
const AttendanceAttempt = require('../models/AttendanceAttempt');
const AttendanceAudit = require('../models/AttendanceAudit');
const SessionConfig = require('../models/SessionConfig');
const SessionInstance = require('../models/SessionInstance');
const { getDistanceMeters, getIstDateStr, sanitizeCsvCell, parseIstDateTime } = require('../utils/geoAndDate');
const {
  getOrCreateSessionInstance,
  processSessionAbsentees,
  deriveStudentStatus,
  getSessionConfig,
} = require('../services/sessionService');

// Protect all admin routes with JWT auth and admin check
router.use(authMiddleware);
router.use(adminOnly);

// ---------------------------------------------------------------------------
// 1. DASHBOARD OVERVIEW
// ---------------------------------------------------------------------------
router.get('/dashboard', async (req, res) => {
  try {
    const today = getIstDateStr();
    const date = req.query.date || today;
    const session = req.query.session || 'morning';

    const sessionInstance = await getOrCreateSessionInstance(date, session);
    const roster = sessionInstance.roster || [];
    const eligibleStudentIds = roster.map((r) => r.studentId);

    // Retrieve authoritative attendance records for this date & session
    const attendanceRecords = await Attendance.find({
      date,
      session,
      studentId: { $in: eligibleStudentIds },
    }).lean();

    const recordMap = new Map();
    attendanceRecords.forEach((rec) => {
      recordMap.set(rec.studentId.toString(), rec);
    });

    let presentCount = 0;
    let absentCount = 0;
    let waitingCount = 0;
    let notStartedCount = 0;
    let processingCount = 0;

    roster.forEach((student) => {
      const rec = recordMap.get(student.studentId.toString());
      const status = deriveStudentStatus(rec, sessionInstance);
      if (status === 'present') presentCount++;
      else if (status === 'absent') absentCount++;
      else if (status === 'waiting') waitingCount++;
      else if (status === 'not-started') notStartedCount++;
      else if (status === 'processing') processingCount++;
    });

    const finalizedTotal = presentCount + absentCount;
    const attendancePercentage =
      finalizedTotal > 0 ? Number(((presentCount / finalizedTotal) * 100).toFixed(1)) : null;

    // Separate count of failed attempts
    const failedAttemptsCount = await AttendanceAttempt.countDocuments({
      date,
      session,
    });

    // Room previews for the overview
    const rooms = await Room.find({ isActive: true }).sort({ floor: 1, roomNumber: 1 }).lean();
    const roomSummaries = rooms.map((room) => {
      const roomMembers = roster.filter(
        (st) =>
          (st.roomId && st.roomId.toString() === room._id.toString()) ||
          st.roomNumber === room.roomNumber
      );
      let rPres = 0;
      let rAbs = 0;
      let rWait = 0;
      let rNotStarted = 0;
      let rProc = 0;

      roomMembers.forEach((member) => {
        const rec = recordMap.get(member.studentId.toString());
        const st = deriveStudentStatus(rec, sessionInstance);
        if (st === 'present') rPres++;
        else if (st === 'absent') rAbs++;
        else if (st === 'waiting') rWait++;
        else if (st === 'not-started') rNotStarted++;
        else if (st === 'processing') rProc++;
      });

      const rFin = rPres + rAbs;
      const rPct = rFin > 0 ? Number(((rPres / rFin) * 100).toFixed(1)) : null;

      return {
        roomId: room._id,
        roomNumber: room.roomNumber,
        floor: room.floor,
        capacity: room.capacity,
        eligibleCount: roomMembers.length,
        presentCount: rPres,
        absentCount: rAbs,
        waitingCount: rWait,
        notStartedCount: rNotStarted,
        processingCount: rProc,
        attendancePercentage: rPct,
      };
    });

    res.json({
      date,
      session,
      sessionInstance: {
        id: sessionInstance._id,
        startTime: sessionInstance.startTime,
        endTime: sessionInstance.endTime,
        deadline: sessionInstance.deadline,
        lifecycleStatus: sessionInstance.lifecycleStatus,
      },
      summary: {
        totalEligible: roster.length,
        presentCount,
        absentCount,
        waitingCount,
        notStartedCount,
        processingCount,
        failedAttemptsCount,
        attendancePercentage,
      },
      rooms: roomSummaries,
    });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving dashboard overview', error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 2. ROOM-WISE ATTENDANCE (Highest Priority)
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/attendance/room-summary
 * Aggregates room-wise attendance metrics for selected date and session
 */
router.get('/attendance/room-summary', async (req, res) => {
  try {
    const today = getIstDateStr();
    const date = req.query.date || today;
    const session = req.query.session || 'morning';
    const floorFilter = req.query.floor;
    const search = req.query.search ? req.query.search.trim().toUpperCase() : null;

    const sessionInstance = await getOrCreateSessionInstance(date, session);
    const roster = sessionInstance.roster || [];
    const eligibleStudentIds = roster.map((r) => r.studentId);

    const attendanceRecords = await Attendance.find({
      date,
      session,
      studentId: { $in: eligibleStudentIds },
    }).lean();

    const recordMap = new Map();
    attendanceRecords.forEach((rec) => {
      recordMap.set(rec.studentId.toString(), rec);
    });

    const roomQuery = { isActive: true };
    if (floorFilter) roomQuery.floor = floorFilter;
    if (search) roomQuery.roomNumber = { $regex: search, $options: 'i' };

    const rooms = await Room.find(roomQuery).sort({ floor: 1, roomNumber: 1 }).lean();

    const roomSummaries = rooms.map((room) => {
      const roomMembers = roster.filter(
        (st) =>
          (st.roomId && st.roomId.toString() === room._id.toString()) ||
          st.roomNumber === room.roomNumber
      );

      let presentCount = 0;
      let absentCount = 0;
      let waitingCount = 0;
      let notStartedCount = 0;
      let processingCount = 0;

      roomMembers.forEach((member) => {
        const rec = recordMap.get(member.studentId.toString());
        const status = deriveStudentStatus(rec, sessionInstance);
        if (status === 'present') presentCount++;
        else if (status === 'absent') absentCount++;
        else if (status === 'waiting') waitingCount++;
        else if (status === 'not-started') notStartedCount++;
        else if (status === 'processing') processingCount++;
      });

      const finalized = presentCount + absentCount;
      const attendancePercentage =
        finalized > 0 ? Number(((presentCount / finalized) * 100).toFixed(1)) : null;

      return {
        roomId: room._id,
        roomNumber: room.roomNumber,
        floor: room.floor,
        capacity: room.capacity,
        eligibleCount: roomMembers.length,
        presentCount,
        absentCount,
        waitingCount,
        notStartedCount,
        processingCount,
        attendancePercentage,
      };
    });

    // Extract list of all unique floors for filter dropdown
    const allFloors = await Room.distinct('floor', { isActive: true });

    res.json({
      date,
      session,
      floors: allFloors.sort(),
      rooms: roomSummaries,
      totalRooms: roomSummaries.length,
    });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving room summaries', error: err.message });
  }
});

/**
 * GET /api/admin/rooms/:id/attendance
 * Detailed student-by-student view inside a specific room
 */
router.get('/rooms/:id/attendance', async (req, res) => {
  try {
    const roomId = req.params.id;
    const today = getIstDateStr();
    const date = req.query.date || today;
    const session = req.query.session || 'morning';
    const statusFilter = req.query.status; // present, absent, waiting, not-started, processing
    const search = req.query.search ? req.query.search.trim().toLowerCase() : null;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const sessionInstance = await getOrCreateSessionInstance(date, session);
    const roster = sessionInstance.roster || [];

    // Filter roster for students assigned to this room
    let roomMembers = roster.filter(
      (st) =>
        (st.roomId && st.roomId.toString() === room._id.toString()) ||
        st.roomNumber === room.roomNumber
    );

    // If session instance roster has 0 members for this room (e.g. newly created room),
    // fallback to current active users assigned to this room
    if (roomMembers.length === 0) {
      const currentUsers = await User.find({
        roomId: room._id,
        isActive: { $ne: false },
        isAdmin: { $ne: true },
      }).lean();

      roomMembers = currentUsers.map((u) => ({
        studentId: u._id,
        rollnumber: u.rollnumber,
        name: u.name,
        roomId: room._id,
        roomNumber: room.roomNumber,
        floor: room.floor,
      }));
    }

    const studentIds = roomMembers.map((m) => m.studentId);

    // Fetch authoritative attendance records
    const attendanceRecords = await Attendance.find({
      studentId: { $in: studentIds },
      date,
      session,
    }).lean();

    const recordMap = new Map();
    attendanceRecords.forEach((rec) => {
      recordMap.set(rec.studentId.toString(), rec);
    });

    // Fetch recent failed attempts for these students if any
    const attempts = await AttendanceAttempt.find({
      studentId: { $in: studentIds },
      date,
      session,
    }).lean();

    const attemptMap = new Map();
    attempts.forEach((att) => {
      const list = attemptMap.get(att.studentId.toString()) || [];
      list.push(att);
      attemptMap.set(att.studentId.toString(), list);
    });

    // Fetch user details for phone & email
    const users = await User.find({ _id: { $in: studentIds } })
      .select('name rollnumber email phone')
      .lean();
    const userMap = new Map();
    users.forEach((u) => userMap.set(u._id.toString(), u));

    let presentCount = 0;
    let absentCount = 0;
    let waitingCount = 0;
    let notStartedCount = 0;
    let processingCount = 0;

    let studentRows = roomMembers.map((member) => {
      const rec = recordMap.get(member.studentId.toString());
      const derivedStatus = deriveStudentStatus(rec, sessionInstance);

      if (derivedStatus === 'present') presentCount++;
      else if (derivedStatus === 'absent') absentCount++;
      else if (derivedStatus === 'waiting') waitingCount++;
      else if (derivedStatus === 'not-started') notStartedCount++;
      else if (derivedStatus === 'processing') processingCount++;

      const userInfo = userMap.get(member.studentId.toString()) || {};
      const studentAttempts = attemptMap.get(member.studentId.toString()) || [];

      return {
        studentId: member.studentId,
        rollnumber: member.rollnumber,
        name: member.name,
        email: userInfo.email || '',
        phone: userInfo.phone || '',
        status: derivedStatus,
        attendanceRecord: rec
          ? {
              id: rec._id,
              status: rec.status,
              timestamp: rec.timestamp,
              latitude: rec.latitude,
              longitude: rec.longitude,
              distanceMeters: rec.distanceMeters,
              evidenceUrl: rec.imageUrl ? `/api/evidence/${rec.imageUrl}` : null,
              source: rec.source,
            }
          : null,
        failedAttempts: studentAttempts.map((fa) => ({
          timestamp: fa.timestamp,
          distanceMeters: fa.distanceMeters,
          outcomeReason: fa.outcomeReason,
        })),
      };
    });

    // Apply search filter
    if (search) {
      studentRows = studentRows.filter(
        (s) =>
          s.name.toLowerCase().includes(search) ||
          s.rollnumber.toLowerCase().includes(search)
      );
    }

    // Apply status filter
    if (statusFilter) {
      studentRows = studentRows.filter((s) => s.status === statusFilter);
    }

    const finalized = presentCount + absentCount;
    const attendancePercentage =
      finalized > 0 ? Number(((presentCount / finalized) * 100).toFixed(1)) : null;

    res.json({
      room: {
        id: room._id,
        roomNumber: room.roomNumber,
        floor: room.floor,
        capacity: room.capacity,
        isActive: room.isActive,
      },
      date,
      session,
      summary: {
        eligibleCount: roomMembers.length,
        presentCount,
        absentCount,
        waitingCount,
        notStartedCount,
        processingCount,
        attendancePercentage,
      },
      students: studentRows,
    });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving room attendance detail', error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 3. ROOM MANAGEMENT
// ---------------------------------------------------------------------------
router.get('/rooms', async (req, res) => {
  try {
    const rooms = await Room.find().sort({ floor: 1, roomNumber: 1 }).lean();
    const studentCounts = await User.aggregate([
      { $match: { isActive: { $ne: false }, isAdmin: { $ne: true }, roomId: { $ne: null } } },
      { $group: { _id: '$roomId', count: { $sum: 1 } } },
    ]);

    const countMap = new Map();
    studentCounts.forEach((sc) => countMap.set(sc._id.toString(), sc.count));

    const enrichedRooms = rooms.map((r) => ({
      ...r,
      currentOccupants: countMap.get(r._id.toString()) || 0,
      availableCapacity: Math.max(0, r.capacity - (countMap.get(r._id.toString()) || 0)),
    }));

    res.json({ rooms: enrichedRooms });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching rooms', error: err.message });
  }
});

router.post('/rooms', async (req, res) => {
  try {
    const { roomNumber, floor, capacity } = req.body;
    if (!roomNumber) {
      return res.status(400).json({ message: 'Room number is required' });
    }

    const cleanRoom = roomNumber.trim().toUpperCase();
    const existing = await Room.findOne({ roomNumber: cleanRoom });
    if (existing) {
      return res.status(409).json({ message: `Room ${cleanRoom} already exists` });
    }

    const room = await Room.create({
      roomNumber: cleanRoom,
      floor: floor ? String(floor).trim() : '1',
      capacity: capacity ? Number(capacity) : 4,
      isActive: true,
    });

    res.status(201).json({ message: 'Room created successfully', room });
  } catch (err) {
    res.status(500).json({ message: 'Error creating room', error: err.message });
  }
});

router.patch('/rooms/:id', async (req, res) => {
  try {
    const { floor, capacity, isActive } = req.body;
    const update = {};
    if (floor !== undefined) update.floor = String(floor).trim();
    if (capacity !== undefined) {
      const capNum = Number(capacity);
      if (isNaN(capNum) || capNum < 1) {
        return res.status(400).json({ message: 'Capacity must be at least 1' });
      }
      update.capacity = capNum;
    }
    if (isActive !== undefined) update.isActive = Boolean(isActive);

    const room = await Room.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    res.json({ message: 'Room updated', room });
  } catch (err) {
    res.status(500).json({ message: 'Error updating room', error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 4. STUDENT MANAGEMENT & ROOM ASSIGNMENT
// ---------------------------------------------------------------------------
router.get('/students', async (req, res) => {
  try {
    const { search, roomId, isActive } = req.query;
    const filter = { isAdmin: { $ne: true } };

    if (roomId) filter.roomId = roomId;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      const s = search.trim();
      filter.$or = [
        { name: { $regex: s, $options: 'i' } },
        { rollnumber: { $regex: s, $options: 'i' } },
        { roomno: { $regex: s, $options: 'i' } },
      ];
    }

    const students = await User.find(filter)
      .select('-password')
      .populate('roomId', 'roomNumber floor capacity isActive')
      .sort({ rollnumber: 1 })
      .lean();

    res.json({ students });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching students', error: err.message });
  }
});

router.patch('/students/:id', async (req, res) => {
  try {
    const { roomId, isActive, name, phone, email } = req.body;
    const student = await User.findById(req.params.id);
    if (!student || student.isAdmin) {
      return res.status(404).json({ message: 'Student not found' });
    }

    if (roomId !== undefined) {
      if (roomId === null || roomId === '') {
        student.roomId = null;
        student.roomno = '';
      } else {
        const room = await Room.findById(roomId);
        if (!room) return res.status(404).json({ message: 'Assigned room not found' });
        if (!room.isActive) {
          return res.status(400).json({ message: `Room ${room.roomNumber} is inactive` });
        }
        // Enforce room capacity
        const currentCount = await User.countDocuments({
          roomId: room._id,
          _id: { $ne: student._id },
          isActive: { $ne: false },
        });
        if (currentCount >= room.capacity) {
          return res.status(400).json({
            message: `Room ${room.roomNumber} is already at full capacity (${room.capacity} students)`,
          });
        }
        student.roomId = room._id;
        student.roomno = room.roomNumber;
      }
    }

    if (isActive !== undefined) student.isActive = Boolean(isActive);
    if (name) student.name = name.trim();
    if (phone) student.phone = phone.trim();
    if (email) student.email = email.trim().toLowerCase();

    await student.save();
    const updated = await User.findById(student._id).select('-password').populate('roomId');
    res.json({ message: 'Student updated successfully', student: updated });
  } catch (err) {
    res.status(500).json({ message: 'Error updating student', error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 5. ATTENDANCE MANAGEMENT & ADMIN CORRECTION WITH AUDIT TRAIL
// ---------------------------------------------------------------------------
router.get('/attendance', async (req, res) => {
  try {
    const { date, session, rollnumber, status, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (date) filter.date = date;
    if (session) filter.session = session;
    if (status) filter.status = status;

    if (rollnumber) {
      const student = await User.findOne({ rollnumber: rollnumber.trim().toLowerCase() });
      if (student) filter.studentId = student._id;
      else return res.json({ records: [], total: 0, page: 1, totalPages: 0 });
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [records, total] = await Promise.all([
      Attendance.find(filter)
        .populate('studentId', 'name rollnumber roomno roomId')
        .sort({ date: -1, timestamp: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Attendance.countDocuments(filter),
    ]);

    const formatted = records.map((r) => ({
      ...r,
      evidenceUrl: r.imageUrl ? `/api/evidence/${r.imageUrl}` : null,
    }));

    res.json({
      records: formatted,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving attendance records', error: err.message });
  }
});

/**
 * PATCH /api/admin/attendance/:id
 * Authorized admin correction requiring a non-empty reason and atomic audit logging
 */
router.patch('/attendance/:id', async (req, res) => {
  try {
    const { status, session, reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'A non-empty correction reason is mandatory' });
    }

    if (status && !['present', 'absent'].includes(status)) {
      return res.status(400).json({ message: 'Status must be either "present" or "absent"' });
    }

    const record = await Attendance.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    const oldValues = {
      status: record.status,
      session: record.session,
      source: record.source,
    };

    const newValues = {};
    if (status) {
      record.status = status;
      newValues.status = status;
    }
    if (session) {
      record.session = session;
      newValues.session = session;
    }

    record.source = 'admin-correction';
    newValues.source = 'admin-correction';

    await record.save();

    // Create append-only audit trail
    const auditEntry = await AttendanceAudit.create({
      attendanceId: record._id,
      studentId: record.studentId,
      sessionInstanceId: record.sessionInstanceId,
      adminId: req.user.id,
      action: 'UPDATE_STATUS',
      reason: reason.trim(),
      oldValues,
      newValues,
      timestamp: new Date(),
    });

    const populatedRecord = await Attendance.findById(record._id).populate('studentId', 'name rollnumber roomno');

    res.json({
      message: 'Attendance corrected and audit log recorded',
      record: populatedRecord,
      audit: auditEntry,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update attendance', error: err.message });
  }
});

/**
 * POST /api/admin/attendance/manual
 * Manually mark attendance for a student who lacks a record (e.g. excused absence or manual present)
 */
router.post('/attendance/manual', async (req, res) => {
  try {
    const { studentId, date, session, status, reason } = req.body;

    if (!studentId || !date || !session || !status || !reason || !reason.trim()) {
      return res.status(400).json({
        message: 'studentId, date, session, status ("present"/"absent"), and a non-empty reason are required',
      });
    }

    if (!['present', 'absent'].includes(status)) {
      return res.status(400).json({ message: 'Status must be "present" or "absent"' });
    }

    const student = await User.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const sessionInstance = await getOrCreateSessionInstance(date, session);

    // Check if record exists
    let record = await Attendance.findOne({ studentId, date, session });
    let isNew = false;
    let oldValues = {};

    if (record) {
      oldValues = { status: record.status, source: record.source };
      record.status = status;
      record.source = 'admin-correction';
      await record.save();
    } else {
      isNew = true;
      record = await Attendance.create({
        studentId,
        sessionInstanceId: sessionInstance._id,
        date,
        session,
        status,
        timestamp: Date.now(),
        latitude: 0,
        longitude: 0,
        distanceMeters: 0,
        source: 'admin-correction',
      });
    }

    // Write audit record
    await AttendanceAudit.create({
      attendanceId: record._id,
      studentId: record.studentId,
      sessionInstanceId: sessionInstance._id,
      adminId: req.user.id,
      action: isNew ? 'CREATE' : 'UPDATE_STATUS',
      reason: reason.trim(),
      oldValues: isNew ? {} : oldValues,
      newValues: { status, source: 'admin-correction' },
      timestamp: new Date(),
    });

    res.json({ message: 'Attendance recorded successfully', record });
  } catch (err) {
    res.status(500).json({ message: 'Failed to record manual attendance', error: err.message });
  }
});

/**
 * GET /api/admin/attendance/:id/audit
 * Fetch audit history for a specific record
 */
router.get('/attendance/:id/audit', async (req, res) => {
  try {
    const history = await AttendanceAudit.find({ attendanceId: req.params.id })
      .populate('adminId', 'name rollnumber')
      .populate('studentId', 'name rollnumber')
      .sort({ timestamp: -1 })
      .lean();
    res.json({ history });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving audit history', error: err.message });
  }
});

/**
 * GET /api/admin/audit
 * Complete audit log with filters and pagination
 */
router.get('/audit', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [logs, total] = await Promise.all([
      AttendanceAudit.find()
        .populate('adminId', 'name rollnumber')
        .populate('studentId', 'name rollnumber roomno')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      AttendanceAudit.countDocuments(),
    ]);

    res.json({
      logs,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching audit logs', error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 6. SESSION CONFIGURATION
// ---------------------------------------------------------------------------
router.get('/session-config', async (req, res) => {
  try {
    const configs = await SessionConfig.find().sort({ session: 1 }).lean();
    res.json({ configs });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving session configuration', error: err.message });
  }
});

router.put('/session-config/:session', async (req, res) => {
  try {
    const sessionKey = req.params.session;
    if (!['morning', 'evening'].includes(sessionKey)) {
      return res.status(400).json({ message: 'Session must be morning or evening' });
    }

    const { startTime, endTime, gracePeriodMinutes, isEnabled, name } = req.body;
    const update = {};

    if (startTime) {
      if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(startTime)) {
        return res.status(400).json({ message: 'Start time must be in HH:mm 24-hour format' });
      }
      update.startTime = startTime;
    }

    if (endTime) {
      if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(endTime)) {
        return res.status(400).json({ message: 'End time must be in HH:mm 24-hour format' });
      }
      update.endTime = endTime;
    }

    if (gracePeriodMinutes !== undefined) {
      const gpm = Number(gracePeriodMinutes);
      if (isNaN(gpm) || gpm < 0) {
        return res.status(400).json({ message: 'Grace period minutes must be 0 or greater' });
      }
      update.gracePeriodMinutes = gpm;
    }

    if (isEnabled !== undefined) update.isEnabled = Boolean(isEnabled);
    if (name) update.name = name.trim();
    update.updatedBy = req.user.id;

    const config = await SessionConfig.findOneAndUpdate(
      { session: sessionKey },
      { $set: update },
      { new: true, upsert: true }
    );

    res.json({ message: 'Session configuration updated for future sessions', config });
  } catch (err) {
    res.status(500).json({ message: 'Error updating session configuration', error: err.message });
  }
});

// Explicit session finalization endpoint
router.post('/sessions/finalize', async (req, res) => {
  try {
    const { date, session } = req.body;
    if (!date || !session) {
      return res.status(400).json({ message: 'Date and session are required' });
    }

    const instance = await SessionInstance.findOne({ date, session });
    if (!instance) {
      return res.status(404).json({ message: 'Session instance not found' });
    }

    const now = new Date();
    if (now < instance.deadline) {
      return res.status(400).json({
        message: `Cannot finalize session before its deadline (${instance.deadline.toLocaleTimeString()})`,
      });
    }

    await processSessionAbsentees(instance);
    const updated = await SessionInstance.findById(instance._id);

    res.json({ message: 'Session finalized successfully', sessionInstance: updated });
  } catch (err) {
    res.status(500).json({ message: 'Error finalizing session', error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 7. REPORTS AND CSV EXPORTS
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/reports/daily
 */
router.get('/reports/daily', async (req, res) => {
  try {
    const today = getIstDateStr();
    const date = req.query.date || today;

    const morningInstance = await getOrCreateSessionInstance(date, 'morning');
    const eveningInstance = await getOrCreateSessionInstance(date, 'evening');

    const morningRecords = await Attendance.find({ date, session: 'morning' }).lean();
    const eveningRecords = await Attendance.find({ date, session: 'evening' }).lean();

    const compileStats = (instance, records) => {
      const roster = instance.roster || [];
      const recMap = new Map();
      records.forEach((r) => recMap.set(r.studentId.toString(), r));

      let present = 0;
      let absent = 0;
      let waiting = 0;
      let notStarted = 0;
      let processing = 0;

      roster.forEach((student) => {
        const rec = recMap.get(student.studentId.toString());
        const status = deriveStudentStatus(rec, instance);
        if (status === 'present') present++;
        else if (status === 'absent') absent++;
        else if (status === 'waiting') waiting++;
        else if (status === 'not-started') notStarted++;
        else if (status === 'processing') processing++;
      });

      const finalized = present + absent;
      const pct = finalized > 0 ? Number(((present / finalized) * 100).toFixed(1)) : null;

      return {
        session: instance.session,
        eligible: roster.length,
        present,
        absent,
        waiting,
        notStarted,
        processing,
        attendancePercentage: pct,
        lifecycleStatus: instance.lifecycleStatus,
      };
    };

    res.json({
      date,
      morning: compileStats(morningInstance, morningRecords),
      evening: compileStats(eveningInstance, eveningRecords),
    });
  } catch (err) {
    res.status(500).json({ message: 'Error compiling daily report', error: err.message });
  }
});

/**
 * GET /api/admin/reports/student
 * Attendance report for an individual student over a date range
 */
router.get('/reports/student', async (req, res) => {
  try {
    const { studentId, rollnumber, startDate, endDate } = req.query;
    let targetStudentId = studentId;

    if (!targetStudentId && rollnumber) {
      const u = await User.findOne({ rollnumber: rollnumber.trim().toLowerCase() });
      if (!u) return res.status(404).json({ message: 'Student not found' });
      targetStudentId = u._id;
    }

    if (!targetStudentId) {
      return res.status(400).json({ message: 'studentId or rollnumber is required' });
    }

    const student = await User.findById(targetStudentId).select('name rollnumber roomno roomId email phone');
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const query = { studentId: targetStudentId };
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      query.date = { $gte: startDate };
    }

    const records = await Attendance.find(query).sort({ date: -1, timestamp: -1 }).lean();

    const presentCount = records.filter((r) => r.status === 'present').length;
    const absentCount = records.filter((r) => r.status === 'absent').length;
    const total = presentCount + absentCount;
    const percentage = total > 0 ? Number(((presentCount / total) * 100).toFixed(1)) : null;

    res.json({
      student,
      summary: {
        totalRecords: records.length,
        presentCount,
        absentCount,
        attendancePercentage: percentage,
      },
      records,
    });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving student report', error: err.message });
  }
});

/**
 * GET /api/admin/export/daily
 * Safe CSV export of daily attendance
 */
router.get('/export/daily', async (req, res) => {
  try {
    const today = getIstDateStr();
    const date = req.query.date || today;
    const session = req.query.session || 'morning';

    const sessionInstance = await getOrCreateSessionInstance(date, session);
    const roster = sessionInstance.roster || [];
    const eligibleStudentIds = roster.map((r) => r.studentId);

    const records = await Attendance.find({
      date,
      session,
      studentId: { $in: eligibleStudentIds },
    }).lean();

    const recordMap = new Map();
    records.forEach((r) => recordMap.set(r.studentId.toString(), r));

    // Build CSV content
    const headers = [
      'Date',
      'Session',
      'Roll Number',
      'Student Name',
      'Room Number',
      'Floor',
      'Status',
      'Timestamp',
      'Distance (meters)',
      'Source',
    ];

    const rows = roster.map((student) => {
      const rec = recordMap.get(student.studentId.toString());
      const status = deriveStudentStatus(rec, sessionInstance);
      const timeStr = rec?.timestamp ? new Date(rec.timestamp).toLocaleTimeString() : 'N/A';
      const distStr = rec?.distanceMeters !== undefined ? rec.distanceMeters : 'N/A';
      const sourceStr = rec?.source || 'N/A';

      return [
        sanitizeCsvCell(date),
        sanitizeCsvCell(session),
        sanitizeCsvCell(student.rollnumber),
        sanitizeCsvCell(student.name),
        sanitizeCsvCell(student.roomNumber),
        sanitizeCsvCell(student.floor),
        sanitizeCsvCell(status),
        sanitizeCsvCell(timeStr),
        sanitizeCsvCell(distStr),
        sanitizeCsvCell(sourceStr),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const filename = `attendance_${date}_${session}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (err) {
    res.status(500).json({ message: 'Error generating daily CSV export', error: err.message });
  }
});

/**
 * GET /api/admin/export/room-wise
 * Safe CSV export of room summary and member details
 */
router.get('/export/room-wise', async (req, res) => {
  try {
    const today = getIstDateStr();
    const date = req.query.date || today;
    const session = req.query.session || 'morning';

    const sessionInstance = await getOrCreateSessionInstance(date, session);
    const roster = sessionInstance.roster || [];
    const eligibleStudentIds = roster.map((r) => r.studentId);

    const records = await Attendance.find({
      date,
      session,
      studentId: { $in: eligibleStudentIds },
    }).lean();

    const recordMap = new Map();
    records.forEach((r) => recordMap.set(r.studentId.toString(), r));

    const headers = [
      'Room Number',
      'Floor',
      'Student Roll No',
      'Student Name',
      'Attendance Status',
      'Timestamp',
      'Distance Meters',
      'Date',
      'Session',
    ];

    // Sort roster by roomNumber, floor, rollnumber
    const sortedRoster = roster.slice().sort((a, b) => {
      if (a.roomNumber !== b.roomNumber) return a.roomNumber.localeCompare(b.roomNumber);
      return a.rollnumber.localeCompare(b.rollnumber);
    });

    const rows = sortedRoster.map((student) => {
      const rec = recordMap.get(student.studentId.toString());
      const status = deriveStudentStatus(rec, sessionInstance);
      const timeStr = rec?.timestamp ? new Date(rec.timestamp).toLocaleTimeString() : 'N/A';
      const dist = rec?.distanceMeters !== undefined ? rec.distanceMeters : 'N/A';

      return [
        sanitizeCsvCell(student.roomNumber),
        sanitizeCsvCell(student.floor),
        sanitizeCsvCell(student.rollnumber),
        sanitizeCsvCell(student.name),
        sanitizeCsvCell(status),
        sanitizeCsvCell(timeStr),
        sanitizeCsvCell(dist),
        sanitizeCsvCell(date),
        sanitizeCsvCell(session),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const filename = `room_attendance_${date}_${session}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (err) {
    res.status(500).json({ message: 'Error generating room CSV export', error: err.message });
  }
});

/**
 * GET /api/admin/export/student
 * Safe CSV export of an individual student's attendance records
 */
router.get('/export/student', async (req, res) => {
  try {
    const { studentId, rollnumber, startDate, endDate } = req.query;
    let targetStudentId = studentId;

    if (!targetStudentId && rollnumber) {
      const u = await User.findOne({ rollnumber: rollnumber.trim().toLowerCase() });
      if (!u) return res.status(404).json({ message: 'Student not found' });
      targetStudentId = u._id;
    }

    if (!targetStudentId) {
      return res.status(400).json({ message: 'studentId or rollnumber is required' });
    }

    const student = await User.findById(targetStudentId).select('name rollnumber roomno');
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const query = { studentId: targetStudentId };
    if (startDate && endDate) query.date = { $gte: startDate, $lte: endDate };
    else if (startDate) query.date = { $gte: startDate };

    const records = await Attendance.find(query).sort({ date: -1, timestamp: -1 }).lean();

    const headers = ['Date', 'Session', 'Status', 'Timestamp', 'Distance (m)', 'Source'];
    const rows = records.map((rec) => [
      sanitizeCsvCell(rec.date),
      sanitizeCsvCell(rec.session),
      sanitizeCsvCell(rec.status),
      sanitizeCsvCell(new Date(rec.timestamp).toLocaleTimeString()),
      sanitizeCsvCell(rec.distanceMeters || 0),
      sanitizeCsvCell(rec.source || 'student-app'),
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    const filename = `student_attendance_${student.rollnumber}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (err) {
    res.status(500).json({ message: 'Error generating student CSV export', error: err.message });
  }
});

module.exports = router;
