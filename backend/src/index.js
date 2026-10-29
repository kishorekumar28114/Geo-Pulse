const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('./config/db');
const User = require('./models/User');
const { ensureDefaultSessionConfigs } = require('./services/sessionService');
const { startScheduler } = require('./scheduler');

const app = express();

// Security HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim().replace(/\/+$/, ''))
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    const normalizedOrigin = origin.replace(/\/+$/, '');

    // Allow if origin is explicitly in allowedOrigins list
    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    // Automatically allow any Vercel preview or production deployment (*.vercel.app)
    if (
      normalizedOrigin.endsWith('.vercel.app') ||
      normalizedOrigin.includes('localhost') ||
      process.env.NODE_ENV !== 'production'
    ) {
      return callback(null, true);
    }

    console.warn(`[CORS Blocked] Origin: ${origin}. Allowed Origins: ${allowedOrigins.join(', ')}`);
    return callback(new Error('CORS policy: Access denied from this origin.'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Disposition', 'Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Database Readiness Middleware: If MongoDB is not connected, return 503 instead of crashing or connection refused
app.use((req, res, next) => {
  // Always let preflight OPTIONS and health checks through
  if (req.method === 'OPTIONS' || req.path === '/api/health') return next();
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message:
        'Database connection is pending or offline. If using MongoDB Atlas, please ensure your IP is whitelisted.',
      status: 'database_unavailable',
    });
  }
  next();
});

// Routes
const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const adminRoutes = require('./routes/admin');
const evidenceRoutes = require('./routes/evidence');

app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/evidence', evidenceRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err.message);
  res.status(err.status || 500).json({
    message: err.message || 'An unexpected server error occurred',
  });
});

/**
 * Ensures administrator account exists with secure bcrypt hash
 */
async function ensureAdminUser() {
  try {
    const admin = await User.findOne({ rollnumber: 'admin' });
    const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'admin123';

    if (!admin) {
      await User.create({
        name: 'Hostel Administrator',
        rollnumber: 'admin',
        email: 'admin@hostel.edu',
        phone: '9876543210',
        password: adminPassword,
        roomno: 'OFFICE',
        isAdmin: true,
        isActive: true,
      });
      console.log('Secure administrator account initialized (rollnumber: admin).');
    } else {
      if (!admin.password.startsWith('$2a$') && !admin.password.startsWith('$2b$')) {
        admin.password = adminPassword;
        await admin.save();
        console.log('Legacy administrator password upgraded to bcrypt hash.');
      }
      if (!admin.isAdmin) {
        admin.isAdmin = true;
        await admin.save();
      }
    }
  } catch (err) {
    console.error('Error ensuring admin user:', err.message);
  }
}

const PORT = process.env.PORT || 5000;

// Start Express server immediately so port 5000 is always listening
const server = app.listen(PORT, () => {
  console.log(`Smart Hostel Attendance Server listening on port ${PORT}`);
});

// Connect to MongoDB with auto-retry
connectDB(async () => {
  await ensureAdminUser();
  await ensureDefaultSessionConfigs();
  startScheduler();
});

module.exports = app;
