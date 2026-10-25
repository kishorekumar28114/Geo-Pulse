const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');
const { attendanceLimiter } = require('../middleware/rateLimit');
const Attendance = require('../models/Attendance');
const AttendanceAttempt = require('../models/AttendanceAttempt');
const User = require('../models/User');
const { HOSTEL_LAT, HOSTEL_LON, ALLOWED_RADIUS_METERS, MAX_IMAGE_SIZE_BYTES, ALLOWED_MIME_TYPES } = require('../config/constants');
const { getDistanceMeters, getIstDateStr, getIstTimeStr } = require('../utils/geoAndDate');
const { getOrCreateSessionInstance, deriveStudentStatus, getSessionConfig } = require('../services/sessionService');

const router = express.Router();
router.use(authMiddleware);

// Multer storage configuration with sanitized unique filename
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    let ext = '.jpg';
    if (file.mimetype === 'image/png') ext = '.png';
    else if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') ext = '.jpg';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueSuffix);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
  fileFilter: function (req, file, cb) {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image format. Only JPEG and PNG are permitted.'));
    }
  },
});

/**
 * GET /api/attendance/sessions
 * Returns today's sessions, deadlines, and current student's status
 */
router.get('/sessions', async (req, res) => {
  try {
    const today = getIstDateStr();
    const morningInstance = await getOrCreateSessionInstance(today, 'morning');
    const eveningInstance = await getOrCreateSessionInstance(today, 'evening');

    const studentId = req.user.id;
    const records = await Attendance.find({
      studentId,
      date: today,
    });

    const morningRecord = records.find((r) => r.session === 'morning');
    const eveningRecord = records.find((r) => r.session === 'evening');

    const now = new Date();

    const formatSessionInfo = (instance, record) => {
      const derivedStatus = deriveStudentStatus(record, instance);
      const isWindowOpen = now >= instance.startTime && now <= instance.deadline;
      const canSubmit = isWindowOpen && !record;

      return {
        session: instance.session,
        date: instance.date,
        startTime: instance.startTime,
        endTime: instance.endTime,
        deadline: instance.deadline,
        lifecycleStatus: instance.lifecycleStatus,
        status: derivedStatus,
        canSubmit,
        isWindowOpen,
        attendanceRecord: record
          ? {
              id: record._id,
              status: record.status,
              timestamp: record.timestamp,
              latitude: record.latitude,
              longitude: record.longitude,
              distanceMeters: record.distanceMeters,
              evidenceUrl: record.imageUrl ? `/api/evidence/${record.imageUrl}` : null,
              source: record.source,
            }
          : null,
      };
    };

    res.json({
      today,
      currentTime: now,
      sessions: [
        formatSessionInfo(morningInstance, morningRecord),
        formatSessionInfo(eveningInstance, eveningRecord),
      ],
      hostelConfig: {
        radiusMeters: ALLOWED_RADIUS_METERS,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving session status', error: err.message });
  }
});

/**
 * POST /api/attendance/register
 * Student registers attendance with photo evidence and GPS coordinates
 */
router.post('/register', attendanceLimiter, upload.single('image'), async (req, res) => {
  const cleanupFile = () => {
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('Failed to unlink file:', e.message);
      }
    }
  };

  try {
    const { latitude, longitude, timestamp, session } = req.body;
    const studentId = req.user.id;

    if (!latitude || !longitude || !req.file) {
      cleanupFile();
      return res.status(400).json({ message: 'Latitude, longitude, and photo evidence are required' });
    }

    const lat = Number(latitude);
    const lon = Number(longitude);
    const ts = timestamp ? Number(timestamp) : Date.now();

    if (isNaN(lat) || isNaN(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      cleanupFile();
      return res.status(400).json({ message: 'Invalid GPS coordinates provided' });
    }

    // Determine session: use requested session or infer from current time
    const today = getIstDateStr();
    let targetSession = session;

    if (!targetSession || !['morning', 'evening'].includes(targetSession)) {
      // Infer based on current open window
      const now = new Date();
      const morningInstance = await getOrCreateSessionInstance(today, 'morning');
      const eveningInstance = await getOrCreateSessionInstance(today, 'evening');

      if (now >= morningInstance.startTime && now <= morningInstance.deadline) {
        targetSession = 'morning';
      } else if (now >= eveningInstance.startTime && now <= eveningInstance.deadline) {
        targetSession = 'evening';
      } else {
        // Fallback to closest or current time
        const currentIstTime = getIstTimeStr(now);
        targetSession = currentIstTime < '14:00' ? 'morning' : 'evening';
      }
    }

    const sessionInstance = await getOrCreateSessionInstance(today, targetSession);
    const now = new Date();

    // Check if session has opened
    if (now < sessionInstance.startTime) {
      cleanupFile();
      return res.status(400).json({
        message: `Attendance for ${targetSession} session has not opened yet. Starts at ${sessionInstance.startTime.toLocaleTimeString()}.`,
      });
    }

    // Check if grace period deadline has passed
    if (now > sessionInstance.deadline) {
      cleanupFile();
      return res.status(400).json({
        message: `Attendance deadline for ${targetSession} session expired at ${sessionInstance.deadline.toLocaleTimeString()}.`,
      });
    }

    // Check if attendance already recorded
    const existing = await Attendance.findOne({
      studentId,
      date: today,
      session: targetSession,
    });

    if (existing) {
      cleanupFile();
      return res.status(409).json({
        message: `Attendance has already been recorded as ${existing.status} for this session.`,
        record: existing,
      });
    }

    // Calculate distance from configured hostel coordinates using Haversine
    const distanceMeters = getDistanceMeters(lat, lon, HOSTEL_LAT, HOSTEL_LON);
    const isWithinRadius = distanceMeters <= ALLOWED_RADIUS_METERS;

    // If outside radius: record attempt, DO NOT mark absent!
    if (!isWithinRadius) {
      await AttendanceAttempt.create({
        studentId,
        sessionInstanceId: sessionInstance._id,
        date: today,
        session: targetSession,
        timestamp: ts,
        outcomeReason: 'out_of_radius',
        latitude: lat,
        longitude: lon,
        distanceMeters,
        imageUrl: req.file.filename,
        ipAddress: req.ip,
      });

      // Keep photo for admin verification of attempt or delete if desired
      return res.status(400).json({
        message: `Location validation failed. You are ${distanceMeters} meters away from the hostel (allowed: ${ALLOWED_RADIUS_METERS}m). Please mark attendance from within the hostel premises.`,
        distanceMeters,
        allowedRadius: ALLOWED_RADIUS_METERS,
      });
    }

    // Within radius: Persist authoritative PRESENT record
    const attendance = new Attendance({
      studentId,
      sessionInstanceId: sessionInstance._id,
      date: today,
      session: targetSession,
      status: 'present',
      timestamp: ts,
      latitude: lat,
      longitude: lon,
      distanceMeters,
      imageUrl: req.file.filename,
      source: 'student-app',
    });

    await attendance.save();

    res.status(200).json({
      message: 'Attendance recorded successfully as Present!',
      attendance: {
        id: attendance._id,
        date: attendance.date,
        session: attendance.session,
        status: attendance.status,
        timestamp: attendance.timestamp,
        distanceMeters: attendance.distanceMeters,
      },
    });
  } catch (err) {
    cleanupFile();
    // Prevent duplicate key crash
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Attendance already recorded for this session.' });
    }
    res.status(500).json({ message: 'Failed to record attendance', error: err.message });
  }
});

/**
 * GET /api/attendance/history
 * Retrieve personal attendance history for student, or filter for admin
 */
router.get('/history', async (req, res) => {
  try {
    const { date, session, studentId: queryStudentId, rollnumber } = req.query;
    let targetStudentId = req.user.id;

    // Non-admin can only view their own history
    if (req.user.isAdmin) {
      if (queryStudentId) {
        targetStudentId = queryStudentId;
      } else if (rollnumber) {
        const student = await User.findOne({ rollnumber: rollnumber.trim().toLowerCase() });
        if (!student) return res.status(404).json({ message: 'Student not found' });
        targetStudentId = student._id;
      }
    }

    const filter = { studentId: targetStudentId };
    if (date) filter.date = date;
    if (session) filter.session = session;

    const history = await Attendance.find(filter)
      .sort({ timestamp: -1 })
      .lean();

    const formattedHistory = history.map((rec) => ({
      ...rec,
      evidenceUrl: rec.imageUrl ? `/api/evidence/${rec.imageUrl}` : null,
    }));

    res.json({ history: formattedHistory });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch history', error: err.message });
  }
});

module.exports = router;
