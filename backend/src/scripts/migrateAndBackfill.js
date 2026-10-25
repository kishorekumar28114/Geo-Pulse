/**
 * Robust Database Migration and Backfill Script
 * 
 * Safely normalizes all existing data:
 * 1. Creates default active hostel rooms (101, 102, 201, 202).
 * 2. Backfills and repairs incomplete legacy user accounts (roll numbers, names, rooms, bcrypt password hashing).
 * 3. Migrates legacy 'failed-location' attendance entries to AttendanceAttempt collection.
 * 4. Ensures SessionConfig defaults exist.
 * 5. Rebuilds and synchronizes all MongoDB indexes.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Room = require('../models/Room');
const SessionConfig = require('../models/SessionConfig');
const Attendance = require('../models/Attendance');
const AttendanceAttempt = require('../models/AttendanceAttempt');
const { DEFAULT_SESSIONS } = require('../config/constants');

async function runMigration() {
  console.log('--- Starting Smart Hostel Database Migration & Backfill ---');
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.error('Error: MONGO_URI is not defined in environment variables.');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB successfully.');

    const db = mongoose.connection.db;

    // 1. Ensure Default Rooms Exist
    console.log('\n[1/5] Ensuring default hostel rooms exist...');
    const defaultRooms = [
      { roomNumber: '101', floor: '1', capacity: 4, isActive: true },
      { roomNumber: '102', floor: '1', capacity: 4, isActive: true },
      { roomNumber: '201', floor: '2', capacity: 4, isActive: true },
      { roomNumber: '202', floor: '2', capacity: 4, isActive: true },
    ];

    for (const dr of defaultRooms) {
      await Room.findOneAndUpdate(
        { roomNumber: dr.roomNumber },
        { $setOnInsert: dr },
        { upsert: true, new: true }
      );
    }
    const allRooms = await Room.find({ isActive: true });
    console.log(`Rooms confirmed. Found ${allRooms.length} active room(s).`);

    // 2. Normalize and Backfill All Users using direct MongoDB updates to bypass strict schema blocks
    console.log('\n[2/5] Repairing and normalizing user accounts...');
    const rawUsers = await db.collection('users').find().toArray();
    let updatedUsers = 0;
    const existingRolls = new Set();

    for (let i = 0; i < rawUsers.length; i++) {
      const u = rawUsers[i];
      const updates = {};

      const isAdmin = u.rollnumber === 'admin' || u.isAdmin === true || u.email === 'admin@hostel.edu';
      updates.isAdmin = isAdmin;
      updates.isActive = u.isActive !== undefined ? u.isActive : true;

      // Ensure Roll Number
      let roll = (u.rollnumber || '').trim().toLowerCase();
      if (!roll) {
        if (isAdmin) {
          roll = 'admin';
        } else if (u.email && u.email.includes('@')) {
          const emailPrefix = u.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          roll = emailPrefix.slice(0, 15) || `stu${u._id.toString().slice(-5)}`;
        } else if (u.username) {
          roll = u.username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 12);
        } else {
          roll = `stu${u._id.toString().slice(-6)}`;
        }
      }

      // Handle duplicate roll numbers across legacy test documents
      let finalRoll = roll;
      let counter = 1;
      while (existingRolls.has(finalRoll)) {
        finalRoll = `${roll}_${counter++}`;
      }
      existingRolls.add(finalRoll);
      updates.rollnumber = finalRoll;

      // Ensure Name
      updates.name = (u.name || u.username || (isAdmin ? 'Hostel Administrator' : `Student ${i + 1}`)).trim();

      // Ensure Email
      updates.email = (u.email || `${finalRoll}@hostel.edu`).trim().toLowerCase();

      // Ensure Phone
      updates.phone = (u.phone || '9876543210').trim();

      // Ensure Bcrypt Hashed Password
      const rawPassword = u.password || 'student123';
      if (!rawPassword.startsWith('$2a$') && !rawPassword.startsWith('$2b$')) {
        const salt = await bcrypt.genSalt(10);
        updates.password = await bcrypt.hash(rawPassword, salt);
      }

      // Ensure Room Assignment
      if (!isAdmin) {
        let assignedRoom = allRooms.find((r) => r.roomNumber === (u.roomno || '').toUpperCase());
        if (!assignedRoom) {
          assignedRoom = allRooms[i % allRooms.length];
        }
        updates.roomId = assignedRoom._id;
        updates.roomno = assignedRoom.roomNumber;
      } else {
        updates.roomno = 'OFFICE';
        updates.roomId = null;
      }

      await db.collection('users').updateOne({ _id: u._id }, { $set: updates });
      updatedUsers++;
    }
    console.log(`Normalized and backfilled ${updatedUsers} user account(s).`);

    // 3. Migrate 'failed-location' attendance entries to AttendanceAttempt
    console.log('\n[3/5] Migrating legacy failed-location attendance records...');
    const failedRecords = await Attendance.find({ status: 'failed-location' });
    let attemptsMigrated = 0;

    for (const rec of failedRecords) {
      await AttendanceAttempt.create({
        studentId: rec.studentId,
        sessionInstanceId: rec.sessionInstanceId || null,
        date: rec.date,
        session: rec.session,
        timestamp: rec.timestamp,
        latitude: rec.latitude,
        longitude: rec.longitude,
        distanceMeters: rec.distanceMeters || 0,
        outcomeReason: 'out_of_radius',
        imageUrl: rec.imageUrl,
      });
      await Attendance.deleteOne({ _id: rec._id });
      attemptsMigrated++;
    }
    console.log(`Migrated ${attemptsMigrated} legacy failed-location record(s) to AttendanceAttempt.`);

    // 4. Ensure SessionConfig defaults exist
    console.log('\n[4/5] Initializing session configurations...');
    for (const key of ['morning', 'evening']) {
      const existing = await SessionConfig.findOne({ session: key });
      if (!existing) {
        await SessionConfig.create(DEFAULT_SESSIONS[key]);
        console.log(`Created default ${key} session configuration.`);
      }
    }

    // 5. Clean up any invalid historical session instances if created with bad rosters
    await db.collection('sessioninstances').deleteMany({ 'roster.rollnumber': { $in: [null, undefined, ''] } });

    console.log('\n[5/5] Re-indexing collections...');
    try {
      await Room.syncIndexes();
      await SessionConfig.syncIndexes();
    } catch (e) {
      console.log('Index sync note:', e.message);
    }

    console.log('\n--- Database Migration & Backfill Completed Successfully ---');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = runMigration;
