const mongoose = require('mongoose');

const attendanceAttemptSchema = new mongoose.Schema(
  {
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
    date: {
      type: String,
      required: true,
    },
    session: {
      type: String,
      enum: ['morning', 'evening'],
      required: true,
    },
    timestamp: {
      type: Number,
      default: Date.now,
    },
    outcomeReason: {
      type: String,
      required: true, // e.g. 'out_of_radius', 'outside_session_time', 'invalid_coordinates', etc.
    },
    latitude: {
      type: Number,
      default: 0,
    },
    longitude: {
      type: Number,
      default: 0,
    },
    distanceMeters: {
      type: Number,
      default: 0,
    },
    imageUrl: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

attendanceAttemptSchema.index({ studentId: 1, date: 1, session: 1 });
attendanceAttemptSchema.index({ timestamp: -1 });

module.exports = mongoose.model('AttendanceAttempt', attendanceAttemptSchema);
