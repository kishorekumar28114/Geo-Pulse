const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    rollnumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      default: null,
    },
    roomno: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving if modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    // If it's already a bcrypt hash, don't rehash
    if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) {
      return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password helper with automatic legacy plaintext migration
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) {
    return bcrypt.compare(candidatePassword, this.password);
  }
  // Legacy plaintext match
  if (this.password === candidatePassword) {
    // Upgrade legacy plaintext to bcrypt
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(candidatePassword, salt);
      await this.save();
    } catch (e) {
      console.error('Failed to auto-upgrade legacy password hash:', e.message);
    }
    return true;
  }
  return false;
};

// Indexes
userSchema.index({ rollnumber: 1 }, { unique: true });
userSchema.index({ roomId: 1, isActive: 1 });
userSchema.index({ isAdmin: 1, isActive: 1 });

module.exports = mongoose.model('User', userSchema);
