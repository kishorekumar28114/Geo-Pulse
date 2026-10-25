const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No authentication token provided, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my_attendance_secret_jwt_key_2026');
    
    // Check if account is active in database (optional check for stale tokens)
    const user = await User.findById(decoded.id).select('isActive isAdmin rollnumber name roomId roomno');
    if (!user) {
      return res.status(401).json({ message: 'User account not found' });
    }
    if (user.isActive === false) {
      return res.status(403).json({ message: 'Account has been deactivated. Contact hostel administrator.' });
    }

    req.user = {
      id: user._id.toString(),
      _id: user._id,
      rollnumber: user.rollnumber,
      name: user.name,
      isAdmin: user.isAdmin,
      roomId: user.roomId,
      roomno: user.roomno,
    };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token is invalid or expired' });
  }
};

const adminOnly = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: 'Administrator access required' });
  }
  next();
};

module.exports = authMiddleware;
module.exports.adminOnly = adminOnly;
