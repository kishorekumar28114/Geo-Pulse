const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    roomNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    floor: {
      type: String,
      required: true,
      trim: true,
      default: '1',
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
      default: 4,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
roomSchema.index({ roomNumber: 1 }, { unique: true });
roomSchema.index({ floor: 1, isActive: 1 });

module.exports = mongoose.model('Room', roomSchema);
