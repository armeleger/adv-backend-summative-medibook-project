// Background worker - a separate process from the web server.
//   npm run worker
// Consumes medibook:jobs:
//   SLOT_FREED        -> book the first eligible waitlisted patient
//   SEND_CONFIRMATION -> write the confirmation message to the audit log
const db = require('./models/db');
const { createBlockingClient, closeRedis } = require('./queues/redisClient');
const jobQueue = require('./queues/jobQueue');
const { promoteFromWaitlist } = require('./services/waitlistService');
const { sendConfirmation } = require('./services/notificationService');
const auditLogger = require('./utils/auditLogger');

const POLL_TIMEOUT_SECONDS = 5;
const ERROR_BACKOFF_MS = 2000;

const handlers = {
  [jobQueue.JOB_TYPES.SLOT_FREED]: async (payload) => {
    const result = await promoteFromWaitlist(payload);
    const outcome = result.promoted
      ? `promoted patient ${result.promoted.patientId} -> appointment ${result.appointment.id}`
      : `nobody promoted (${result.reason})`;
    console.log(`[worker] slot ${payload.appointmentDatetime} doctor ${payload.doctorId}: ${outcome}`);
  },
  [jobQueue.JOB_TYPES.SEND_CONFIRMATION]: async (payload) => {
    await sendConfirmation(payload);
    console.log(`[worker] confirmation sent for appointment ${payload.appointmentId}`);
  },
};

let running = true;
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function processJob({ raw, job }) {
  const handler = handlers[job.type];
  if (!handler) {
    // Retrying cannot help a job type this worker does not know.
    await jobQueue.retryOrFail(raw, job, new Error(`Unknown job type ${job.type}`), { retryable: false });
    console.error(`[worker] unknown job type ${job.type} moved to failed list`);
    await auditLogger.log('JOB_FAILED', { jobId: job.id, type: job.type, error: 'UNKNOWN_JOB_TYPE' });
    return;
  }
  try {
    await handler(job.payload);
    await jobQueue.complete(raw);
  } catch (err) {
    const { attempts, gaveUp } = await jobQueue.retryOrFail(raw, job, err);
    console.error(`[worker] ${job.type} failed (attempt ${attempts}/${jobQueue.MAX_ATTEMPTS}): ${err.message}`);
    if (gaveUp) {
      await auditLogger.log('JOB_FAILED', { jobId: job.id, type: job.type, payload: job.payload, error: err.message });
    }
  }
}

async function run() {
  await auditLogger.init();
  await db.ping();
  const blockingClient = createBlockingClient();

  const recovered = await jobQueue.requeueInterrupted();
  if (recovered > 0) console.log(`[worker] re-queued ${recovered} interrupted job(s)`);
  console.log('[worker] waiting for jobs...');

  while (running) {
    try {
      const reserved = await jobQueue.reserveNext(blockingClient, POLL_TIMEOUT_SECONDS);
      if (reserved) await processJob(reserved);
    } catch (err) {
      // Redis/MySQL outage: back off and keep going. Any job that was mid-way
      // is still in the processing list and is recovered on the next start.
      console.error(`[worker] ${err.message}`);
      await sleep(ERROR_BACKOFF_MS);
    }
  }

  blockingClient.disconnect();
  await closeRedis();
  await db.close();
  console.log('[worker] stopped');
}

function stop() {
  console.log('[worker] finishing current job, then stopping...');
  running = false;
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

run().catch((err) => {
  console.error(`[worker] failed to start: ${err.message}`);
  process.exit(1);
});
