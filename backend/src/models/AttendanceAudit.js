const mongoose = require('mongoose');

const attendanceAuditSchema = new mongoose.Schema(
  {
    attendanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attendance',
      default: null,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sessionInstanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SessionInstance',
      default: null,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: ['CREATE', 'UPDATE_STATUS', 'UPDATE_SESSION', 'DELETE'],
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    oldValues: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    newValues: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Append-only audit trail indexes
attendanceAuditSchema.index({ attendanceId: 1, timestamp: -1 });
attendanceAuditSchema.index({ studentId: 1, timestamp: -1 });
attendanceAuditSchema.index({ adminId: 1, timestamp: -1 });

module.exports = mongoose.model('AttendanceAudit', attendanceAuditSchema);
