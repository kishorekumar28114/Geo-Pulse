const { deriveStudentStatus } = require('../src/services/sessionService');

describe('Session Attendance Status Derivation Tests', () => {
  const baseSessionInstance = {
    date: '2026-10-24',
    session: 'morning',
    startTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour in future
    endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
    deadline: new Date(Date.now() + 2.5 * 60 * 60 * 1000),
    lifecycleStatus: 'not-started',
  };

  test('Authoritative present record always derives as "present"', () => {
    const record = { status: 'present', timestamp: Date.now() };
    const status = deriveStudentStatus(record, baseSessionInstance);
    expect(status).toBe('present');
  });

  test('Authoritative absent record always derives as "absent"', () => {
    const record = { status: 'absent', timestamp: Date.now() };
    const status = deriveStudentStatus(record, baseSessionInstance);
    expect(status).toBe('absent');
  });

  test('When session has not started yet and student has no record, status is "not-started"', () => {
    const status = deriveStudentStatus(null, baseSessionInstance);
    expect(status).toBe('not-started');
  });

  test('When session is open (between start and deadline) and no record, status is "waiting"', () => {
    const openInstance = {
      ...baseSessionInstance,
      startTime: new Date(Date.now() - 30 * 60 * 1000), // started 30 mins ago
      endTime: new Date(Date.now() + 30 * 60 * 1000),
      deadline: new Date(Date.now() + 45 * 60 * 1000), // deadline in 45 mins
      lifecycleStatus: 'active',
    };
    const status = deriveStudentStatus(null, openInstance);
    expect(status).toBe('waiting');
  });

  test('When session is in grace period (between end and deadline) and no record, status is still "waiting"', () => {
    const graceInstance = {
      ...baseSessionInstance,
      startTime: new Date(Date.now() - 90 * 60 * 1000),
      endTime: new Date(Date.now() - 5 * 60 * 1000), // ended 5 mins ago
      deadline: new Date(Date.now() + 10 * 60 * 1000), // deadline in 10 mins
      lifecycleStatus: 'grace-period',
    };
    const status = deriveStudentStatus(null, graceInstance);
    expect(status).toBe('waiting');
  });

  test('When deadline has passed but finalization has not completed, status is "processing"', () => {
    const processingInstance = {
      ...baseSessionInstance,
      startTime: new Date(Date.now() - 120 * 60 * 1000),
      endTime: new Date(Date.now() - 40 * 60 * 1000),
      deadline: new Date(Date.now() - 20 * 60 * 1000), // deadline 20 mins ago
      lifecycleStatus: 'processing',
    };
    const status = deriveStudentStatus(null, processingInstance);
    expect(status).toBe('processing');
  });

  test('When deadline has passed and session is finalized, missing record derives as "absent"', () => {
    const finalizedInstance = {
      ...baseSessionInstance,
      startTime: new Date(Date.now() - 120 * 60 * 1000),
      endTime: new Date(Date.now() - 40 * 60 * 1000),
      deadline: new Date(Date.now() - 20 * 60 * 1000),
      lifecycleStatus: 'finalized',
    };
    const status = deriveStudentStatus(null, finalizedInstance);
    expect(status).toBe('absent');
  });
});
