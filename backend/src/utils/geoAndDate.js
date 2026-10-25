/**
 * Utility functions for Geolocation, Date handling in Asia/Kolkata, and CSV sanitization
 */

const { TIMEZONE } = require('../config/constants');

/**
 * Calculates Haversine distance in meters between two lat/lon pairs
 */
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Formats a Date object into YYYY-MM-DD in Asia/Kolkata
 */
function getIstDateStr(dateObj = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(dateObj); // 'YYYY-MM-DD'
}

/**
 * Formats a Date object into HH:mm in Asia/Kolkata
 */
function getIstTimeStr(dateObj = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(dateObj); // 'HH:mm'
}

/**
 * Parses dateStr ('YYYY-MM-DD') and timeStr ('HH:mm') in Asia/Kolkata (+05:30) into a Date instance
 */
function parseIstDateTime(dateStr, timeStr) {
  // ISO with explicit +05:30 offset
  const [hours, minutes] = timeStr.split(':');
  const isoStr = `${dateStr}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00+05:30`;
  return new Date(isoStr);
}

/**
 * Sanitizes a CSV cell to prevent spreadsheet formula injection and escape quotes
 */
function sanitizeCsvCell(value) {
  if (value === null || value === undefined) return '""';
  let str = String(value);

  // If starts with formula triggers (=, +, -, @, tab, carriage return), prefix with single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape inner double quotes
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

module.exports = {
  getDistanceMeters,
  getIstDateStr,
  getIstTimeStr,
  parseIstDateTime,
  sanitizeCsvCell,
};
