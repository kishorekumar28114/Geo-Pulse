const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async (onConnected) => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('CRITICAL: MONGO_URI is not set in environment variables.');
    return;
  }

  const tryConnect = async () => {
    try {
      await mongoose.connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 6000,
      });
      console.log('MongoDB connected successfully.');
      if (onConnected) {
        await onConnected();
      }
    } catch (err) {
      console.error('\n================ MONGODB CONNECTION NOTICE ================');
      console.error('MongoDB connection attempt failed:', err.message);
      console.error('If using MongoDB Atlas, verify that your IP is whitelisted:');
      console.error('1. Go to cloud.mongodb.com -> Network Access');
      console.error('2. Add IP: 103.183.240.250 (or 0.0.0.0/0 to allow all)');
      console.error('The server will stay active on port 5000 and auto-retry in 10s...');
      console.error('===========================================================\n');
      setTimeout(tryConnect, 10000);
    }
  };

  await tryConnect();
};

module.exports = connectDB;
