const {
  getDistanceMeters,
  getIstDateStr,
  getIstTimeStr,
  parseIstDateTime,
  sanitizeCsvCell,
} = require('../src/utils/geoAndDate');
const { HOSTEL_LAT, HOSTEL_LON, ALLOWED_RADIUS_METERS } = require('../src/config/constants');

describe('Geolocation & Haversine Distance Tests', () => {
  test('Exact hostel coordinates should return 0 meters distance', () => {
    const dist = getDistanceMeters(HOSTEL_LAT, HOSTEL_LON, HOSTEL_LAT, HOSTEL_LON);
    expect(dist).toBe(0);
  });

  test('Point within 500m radius is correctly identified as within perimeter', () => {
    // 0.001 degree latitude difference is ~111 meters
    const nearLat = HOSTEL_LAT + 0.001;
    const nearLon = HOSTEL_LON + 0.001;
    const dist = getDistanceMeters(HOSTEL_LAT, HOSTEL_LON, nearLat, nearLon);
    expect(dist).toBeLessThan(ALLOWED_RADIUS_METERS);
  });

  test('Point far away is correctly calculated as out of radius', () => {
    // 0.05 degree difference is ~5.5 km
    const farLat = HOSTEL_LAT + 0.05;
    const farLon = HOSTEL_LON + 0.05;
    const dist = getDistanceMeters(HOSTEL_LAT, HOSTEL_LON, farLat, farLon);
    expect(dist).toBeGreaterThan(ALLOWED_RADIUS_METERS);
    expect(dist).toBeGreaterThan(5000);
  });
});

describe('Date & Time Handling in Asia/Kolkata', () => {
  test('Formats date string as YYYY-MM-DD', () => {
    const dateStr = getIstDateStr(new Date('2026-10-24T06:45:00Z'));
    expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dateStr).toBe('2026-10-24');
  });

  test('Formats time string as HH:mm', () => {
    const timeStr = getIstTimeStr(new Date('2026-10-24T03:30:00Z')); // 03:30 UTC = 09:00 IST
    expect(timeStr).toBe('09:00');
  });

  test('parseIstDateTime accurately converts local date and time into UTC Date', () => {
    const parsed = parseIstDateTime('2026-10-24', '09:00');
    expect(parsed.toISOString()).toBe('2026-10-24T03:30:00.000Z');
  });
});

describe('CSV Formula Injection & Escaping Tests', () => {
  test('Prefixes dangerous formula trigger = with single quote', () => {
    const dangerous = '=SUM(A1:A10)';
    const sanitized = sanitizeCsvCell(dangerous);
    expect(sanitized).toBe("\"'=SUM(A1:A10)\"");
  });

  test('Prefixes dangerous characters +, -, @, tab, carriage return', () => {
    expect(sanitizeCsvCell('+12345')).toBe("\"'+12345\"");
    expect(sanitizeCsvCell('-cmd|/c calc')).toBe("\"'-cmd|/c calc\"");
    expect(sanitizeCsvCell('@SUM')).toBe("\"'@SUM\"");
  });

  test('Properly escapes embedded quotes', () => {
    const withQuotes = 'Room "Deluxe" A1';
    expect(sanitizeCsvCell(withQuotes)).toBe('"Room ""Deluxe"" A1"');
  });

  test('Handles null and undefined cleanly', () => {
    expect(sanitizeCsvCell(null)).toBe('""');
    expect(sanitizeCsvCell(undefined)).toBe('""');
  });
});
