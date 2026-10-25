const mongoose = require('mongoose');

const sessionConfigSchema = new mongoose.Schema(
  {
    session: {
      type: String,
      enum: ['morning', 'evening'],
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    startTime: {
      type: String,
      required: true, // e.g. "09:00" in 24-hr format
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },
    endTime: {
      type: String,
      required: true, // e.g. "11:00" in 24-hr format
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },
    gracePeriodMinutes: {
      type: Number,
      required: true,
      min: 0,
      default: 15,
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

sessionConfigSchema.index({ session: 1 }, { unique: true });

module.exports = mongoose.model('SessionConfig', sessionConfigSchema);
