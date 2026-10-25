const express = require('express');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');
const Attendance = require('../models/Attendance');
const AttendanceAttempt = require('../models/AttendanceAttempt');

const router = express.Router();
router.use(authMiddleware);

const uploadsDir = path.join(__dirname, '../../uploads');

/**
 * GET /api/evidence/:filename
 * Secure, authenticated photo evidence delivery.
 * Prohibits path traversal and public snooping.
 * Only accessible to verified admins or the student owner.
 */
router.get('/:filename', async (req, res) => {
  try {
    const rawFilename = req.params.filename;

    // Sanitize filename against path traversal
    const safeFilename = path.basename(rawFilename);
    if (safeFilename !== rawFilename || safeFilename.includes('..') || safeFilename.includes('/') || safeFilename.includes('\\')) {
      return res.status(400).json({ message: 'Invalid file request' });
    }

    const filePath = path.join(uploadsDir, safeFilename);

    // Verify file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Evidence file not found' });
    }

    // Authorization check
    if (req.user.isAdmin) {
      // Admins are authorized
      return res.sendFile(filePath);
    }

    // If student, check ownership in Attendance or AttendanceAttempt
    const ownRecord = await Attendance.findOne({
      studentId: req.user.id,
      imageUrl: safeFilename,
    });

    if (ownRecord) {
      return res.sendFile(filePath);
    }

    const ownAttempt = await AttendanceAttempt.findOne({
      studentId: req.user.id,
      imageUrl: safeFilename,
    });

    if (ownAttempt) {
      return res.sendFile(filePath);
    }

    return res.status(403).json({ message: 'Access denied to this evidence file' });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving evidence file', error: err.message });
  }
});

module.exports = router;
