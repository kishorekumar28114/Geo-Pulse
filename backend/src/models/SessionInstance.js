const mongoose = require('mongoose');

const sessionRosterItemSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rollnumber: {
      type: String,
      default: 'N/A',
    },
    name: {
      type: String,
      default: 'Student',
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      default: null,
    },
    roomNumber: {
      type: String,
      default: 'Unassigned',
    },
    floor: {
      type: String,
      default: '1',
    },
  },
  { _id: false }
);

const sessionInstanceSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true, // 'YYYY-MM-DD'
    },
    session: {
      type: String,
      enum: ['morning', 'evening'],
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    deadline: {
      type: Date,
      required: true, // endTime + gracePeriodMinutes
    },
    lifecycleStatus: {
      type: String,
      enum: ['not-started', 'active', 'grace-period', 'processing', 'finalized'],
      default: 'not-started',
    },
    roster: [sessionRosterItemSchema],
  },
  {
    timestamps: true,
  }
);

sessionInstanceSchema.index({ date: 1, session: 1 }, { unique: true });
sessionInstanceSchema.index({ deadline: 1, lifecycleStatus: 1 });

module.exports = mongoose.model('SessionInstance', sessionInstanceSchema);
