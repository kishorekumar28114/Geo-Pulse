/**
 * Application Constants and Hostel Configuration
 */
module.exports = {
  // Geolocation reference for hostel
  HOSTEL_LAT: 10.827764,
  HOSTEL_LON: 77.060015,
  ALLOWED_RADIUS_METERS: 500,

  // Default Timezone
  TIMEZONE: 'Asia/Kolkata',

  // Upload constraints
  MAX_IMAGE_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/jpg'],

  // Default session configurations
  DEFAULT_SESSIONS: {
    morning: {
      session: 'morning',
      name: 'Morning Attendance',
      startTime: '09:00',
      endTime: '11:00',
      gracePeriodMinutes: 15,
      timezone: 'Asia/Kolkata',
      isEnabled: true,
    },
    evening: {
      session: 'evening',
      name: 'Evening Attendance',
      startTime: '18:00',
      endTime: '20:00',
      gracePeriodMinutes: 15,
      timezone: 'Asia/Kolkata',
      isEnabled: true,
    },
  },
};
