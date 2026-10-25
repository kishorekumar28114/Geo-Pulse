const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Room = require('../models/Room');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id.toString(), rollnumber: user.rollnumber, isAdmin: user.isAdmin },
    process.env.JWT_SECRET || 'my_attendance_secret_jwt_key_2026',
    { expiresIn: '7d' }
  );
};

// Signup
router.post('/signup', authLimiter, async (req, res) => {
  try {
    const { name, rollnumber, email, phone, password, roomno } = req.body;
    if (!name || !rollnumber || !email || !phone || !password) {
      return res.status(400).json({ message: 'Name, roll number, email, phone, and password are required' });
    }

    const cleanRoll = rollnumber.trim().toLowerCase();
    const existing = await User.findOne({ rollnumber: cleanRoll });
    if (existing) {
      return res.status(409).json({ message: 'Roll number already exists' });
    }

    let assignedRoomId = null;
    let roomNumberStr = (roomno || '').trim().toUpperCase();

    if (roomNumberStr) {
      // Find room or create if not existing
      let room = await Room.findOne({ roomNumber: roomNumberStr });
      if (!room) {
        room = await Room.create({
          roomNumber: roomNumberStr,
          floor: roomNumberStr.charAt(0).match(/\d/) ? roomNumberStr.charAt(0) : '1',
          capacity: 4,
          isActive: true,
        });
      }

      if (!room.isActive) {
        return res.status(400).json({ message: `Room ${roomNumberStr} is currently inactive` });
      }

      // Check room capacity
      const currentOccupants = await User.countDocuments({
        roomId: room._id,
        isActive: { $ne: false },
      });
      if (currentOccupants >= room.capacity) {
        return res.status(400).json({
          message: `Room ${roomNumberStr} is at maximum capacity (${room.capacity} students)`,
        });
      }
      assignedRoomId = room._id;
      roomNumberStr = room.roomNumber;
    }

    const user = new User({
      name: name.trim(),
      rollnumber: cleanRoll,
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      password,
      roomId: assignedRoomId,
      roomno: roomNumberStr,
      isAdmin: false,
      isActive: true,
    });

    await user.save();

    const token = generateToken(user);
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        rollnumber: user.rollnumber,
        name: user.name,
        email: user.email,
        phone: user.phone,
        roomId: user.roomId,
        roomno: user.roomno,
        isAdmin: false,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
});

// Login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { rollnumber, password } = req.body;
    if (!rollnumber || !password) {
      return res.status(400).json({ message: 'Roll number and password are required' });
    }

    const cleanRoll = rollnumber.trim().toLowerCase();
    const user = await User.findOne({ rollnumber: cleanRoll }).populate('roomId');
    if (!user) {
      return res.status(401).json({ message: 'Invalid roll number or password' });
    }

    if (user.isActive === false) {
      return res.status(403).json({ message: 'Your account is deactivated. Contact administrator.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid roll number or password' });
    }

    const token = generateToken(user);
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        rollnumber: user.rollnumber,
        name: user.name,
        email: user.email,
        phone: user.phone,
        roomId: user.roomId?._id || user.roomId,
        roomno: user.roomId?.roomNumber || user.roomno,
        floor: user.roomId?.floor || '1',
        isAdmin: user.isAdmin,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
});

// Current User Profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password').populate('roomId');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      user: {
        id: user._id,
        rollnumber: user.rollnumber,
        name: user.name,
        email: user.email,
        phone: user.phone,
        roomId: user.roomId?._id || user.roomId,
        roomno: user.roomId?.roomNumber || user.roomno,
        floor: user.roomId?.floor || '1',
        isAdmin: user.isAdmin,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving profile', error: err.message });
  }
});

module.exports = router;
