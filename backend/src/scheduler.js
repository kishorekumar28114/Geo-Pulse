const cron = require('node-cron');
const SessionInstance = require('./models/SessionInstance');
const { getOrCreateSessionInstance, processSessionAbsentees } = require('./services/sessionService');
const { getIstDateStr } = require('./utils/geoAndDate');

let isRunning = false;

/**
 * Checks and finalizes any session instances whose deadline has passed
 */
async function checkAndFinalizeSessions() {
  if (isRunning) return;
  isRunning = true;
  try {
    const today = getIstDateStr();

    // Ensure session instances exist for today's morning and evening
    await getOrCreateSessionInstance(today, 'morning');
    await getOrCreateSessionInstance(today, 'evening');

    // Find all session instances whose deadline has elapsed and not yet finalized
    const now = new Date();
    const pendingInstances = await SessionInstance.find({
      deadline: { $lte: now },
      lifecycleStatus: { $ne: 'finalized' },
    });

    for (const instance of pendingInstances) {
      await processSessionAbsentees(instance);
    }
  } catch (err) {
    console.error('Error during scheduled session absence check:', err.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Initializes deadline-based session processing scheduler.
 * Runs every minute to guarantee accurate deadline handling without fixed hardcoded hours.
 */
function startScheduler() {
  console.log('Starting deadline-based session absence scheduler (runs every minute)...');
  // Run on startup
  checkAndFinalizeSessions();

  // Schedule to run every minute
  cron.schedule('* * * * *', async () => {
    await checkAndFinalizeSessions();
  });
}

module.exports = {
  startScheduler,
  checkAndFinalizeSessions,
};
