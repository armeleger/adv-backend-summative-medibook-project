// Reliable background job queue on plain Redis lists.
//
//   API process ── RPUSH ──▶ medibook:jobs ── BLMOVE ──▶ medibook:jobs:processing ──▶ worker
//
// BLMOVE moves a job to the processing list atomically, so a job is never
// "in flight" outside Redis: if the worker crashes mid-job, the job is still
// in medibook:jobs:processing and is put back on the queue at the next start.
// Failed jobs are retried up to MAX_ATTEMPTS, then parked in medibook:jobs:failed.
const { randomUUID } = require('node:crypto');
const { getRedis } = require('./redisClient');
const auditLogger = require('../utils/auditLogger');

const KEYS = Object.freeze({
  pending: 'medibook:jobs',
  processing: 'medibook:jobs:processing',
  failed: 'medibook:jobs:failed',
});

const JOB_TYPES = Object.freeze({
  SEND_CONFIRMATION: 'SEND_CONFIRMATION',
  SLOT_FREED: 'SLOT_FREED',
});

const MAX_ATTEMPTS = 5;

// Called after the database work is committed. It never throws: the booking
// or cancellation already succeeded and must not be reported as failed just
// because Redis is unavailable. The failure is logged for follow-up.
async function enqueue(type, payload) {
  const job = { id: randomUUID(), type, payload, attempts: 0, enqueuedAt: new Date().toISOString() };
  try {
    await getRedis().rpush(KEYS.pending, JSON.stringify(job));
    return job;
  } catch (err) {
    console.error(`[queue] could not enqueue ${type}: ${err.message}`);
    await auditLogger.log('JOB_ENQUEUE_FAILED', { type, payload, error: err.message });
    return null;
  }
}

// ---- worker side -----------------------------------------------------------

// Returns the job object, or null if raw is not a valid job (bad JSON, or
// missing type/payload). Pure, so it is unit tested.
function parseJob(raw) {
  try {
    const job = JSON.parse(raw);
    const valid = job !== null && typeof job === 'object' && typeof job.type === 'string'
      && job.payload !== null && typeof job.payload === 'object';
    return valid ? { attempts: 0, ...job } : null;
  } catch {
    return null;
  }
}

// Removes a job from processing and parks it in the failed list, atomically.
async function moveToFailed(raw, failedEntry) {
  await getRedis()
    .multi()
    .lrem(KEYS.processing, 1, raw)
    .rpush(KEYS.failed, JSON.stringify(failedEntry))
    .exec();
}

// Waits up to timeoutSeconds for the next job. Returns { raw, job } or null.
// A malformed job can never succeed, so it goes straight to the failed list
// instead of sitting in processing and being re-queued on every restart.
async function reserveNext(blockingClient, timeoutSeconds) {
  const raw = await blockingClient.blmove(KEYS.pending, KEYS.processing, 'LEFT', 'RIGHT', timeoutSeconds);
  if (!raw) return null;
  const job = parseJob(raw);
  if (!job) {
    await moveToFailed(raw, { raw, lastError: 'MALFORMED_JOB', failedAt: new Date().toISOString() });
    console.error(`[queue] malformed job moved to ${KEYS.failed}: ${raw.slice(0, 100)}`);
    await auditLogger.log('JOB_FAILED', { reason: 'MALFORMED_JOB', raw: raw.slice(0, 500) });
    return null;
  }
  return { raw, job };
}

async function complete(raw) {
  await getRedis().lrem(KEYS.processing, 1, raw);
}

// Removes the job from processing and either re-queues it (attempts + 1) or
// moves it to the failed list - in one MULTI so it is never in neither list.
// retryable: false for errors that can never succeed (e.g. unknown job type).
async function retryOrFail(raw, job, error, { retryable = true } = {}) {
  const attempts = job.attempts + 1;
  const updated = JSON.stringify({ ...job, attempts, lastError: error.message });
  const giveUp = !retryable || attempts >= MAX_ATTEMPTS;
  await getRedis()
    .multi()
    .lrem(KEYS.processing, 1, raw)
    .rpush(giveUp ? KEYS.failed : KEYS.pending, updated)
    .exec();
  return { attempts, gaveUp: giveUp };
}

// On worker start-up: anything left in processing belongs to a worker that
// died mid-job, so put it back at the front of the queue.
async function requeueInterrupted() {
  let count = 0;
  while (await getRedis().lmove(KEYS.processing, KEYS.pending, 'RIGHT', 'LEFT')) count += 1;
  return count;
}

module.exports = {
  JOB_TYPES,
  KEYS,
  MAX_ATTEMPTS,
  enqueue,
  parseJob,
  reserveNext,
  complete,
  retryOrFail,
  requeueInterrupted,
};
