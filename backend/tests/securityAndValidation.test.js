const bcrypt = require('bcryptjs');

describe('Security, Password Hashing & Migration Tests', () => {
  test('Bcrypt generates salted hash starting with $2a$ or $2b$', async () => {
    const rawPassword = 'SecureStudentPass2026!';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(rawPassword, salt);

    expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true);
    expect(await bcrypt.compare(rawPassword, hash)).toBe(true);
    expect(await bcrypt.compare('WrongPassword', hash)).toBe(false);
  });

  test('Legacy plaintext password can be compared and upgraded to bcrypt', async () => {
    // Mock user model instance
    const mockUser = {
      rollnumber: '21cs101',
      password: 'legacyPlaintextPassword',
      async comparePassword(candidate) {
        if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) {
          return bcrypt.compare(candidate, this.password);
        }
        if (this.password === candidate) {
          // Upgrade
          const salt = await bcrypt.genSalt(10);
          this.password = await bcrypt.hash(candidate, salt);
          return true;
        }
        return false;
      },
    };

    // First login with legacy plaintext
    const matched = await mockUser.comparePassword('legacyPlaintextPassword');
    expect(matched).toBe(true);
    // Verified that password was upgraded to bcrypt
    expect(mockUser.password.startsWith('$2a$') || mockUser.password.startsWith('$2b$')).toBe(true);

    // Second login now uses bcrypt
    const secondMatch = await mockUser.comparePassword('legacyPlaintextPassword');
    expect(secondMatch).toBe(true);

    const wrongMatch = await mockUser.comparePassword('Incorrect');
    expect(wrongMatch).toBe(false);
  });
});

describe('Attendance Percentage Calculation Business Rule', () => {
  function calculateAttendancePercentage(present, absent, waiting = 0, notStarted = 0) {
    const finalized = present + absent;
    if (finalized === 0) return null; // N/A
    return Number(((present / finalized) * 100).toFixed(1));
  }

  test('Calculates percentage as Present / (Present + Absent) * 100', () => {
    // 8 present, 2 absent, 10 waiting -> finalized = 10 -> 80.0%
    const pct = calculateAttendancePercentage(8, 2, 10, 5);
    expect(pct).toBe(80.0);
  });

  test('Excludes Waiting and Not Started students from denominator', () => {
    // 5 present, 0 absent, 15 waiting -> finalized = 5 -> 100%
    const pct = calculateAttendancePercentage(5, 0, 15, 20);
    expect(pct).toBe(100.0);
  });

  test('Returns null (displaying N/A in UI) when there are no finalized outcomes', () => {
    const pct = calculateAttendancePercentage(0, 0, 10, 10);
    expect(pct).toBeNull();
  });
});
