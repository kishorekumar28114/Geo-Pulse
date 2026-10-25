const rateLimit = require('express-rate-limit');

// Rate limiter for authentication attempts (login & signup)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 auth requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many login attempts from this IP, please try again after 15 minutes',
  },
});

// Rate limiter for attendance submission
const attendanceLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 submissions per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many attendance submissions from this IP, please wait a moment',
  },
});

module.exports = {
  authLimiter,
  attendanceLimiter,
};
