const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
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
      required: true, // 'YYYY-MM-DD'
    },
    session: {
      type: String,
      enum: ['morning', 'evening'],
      required: true,
    },
    status: {
      type: String,
      enum: ['present', 'absent'],
      required: true,
    },
    timestamp: {
      type: Number,
      required: true,
      default: Date.now,
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
    source: {
      type: String,
      enum: ['student-app', 'admin-correction', 'scheduler'],
      default: 'student-app',
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique constraints to prevent duplicate attendance
attendanceSchema.index({ studentId: 1, date: 1, session: 1 }, { unique: true });
attendanceSchema.index({ sessionInstanceId: 1 });
attendanceSchema.index({ date: 1, session: 1, status: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
