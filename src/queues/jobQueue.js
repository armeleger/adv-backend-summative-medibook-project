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

// Waits up to timeoutSeconds for the next job. Returns { raw, job } or null.
async function reserveNext(blockingClient, timeoutSeconds) {
  const raw = await blockingClient.blmove(KEYS.pending, KEYS.processing, 'LEFT', 'RIGHT', timeoutSeconds);
  return raw ? { raw, job: JSON.parse(raw) } : null;
}

async function complete(raw) {
  await getRedis().lrem(KEYS.processing, 1, raw);
}

// Removes the job from processing and either re-queues it (attempts + 1) or
// moves it to the failed list - in one MULTI so it is never in neither list.
async function retryOrFail(raw, job, error) {
  const attempts = job.attempts + 1;
  const updated = JSON.stringify({ ...job, attempts, lastError: error.message });
  const giveUp = attempts >= MAX_ATTEMPTS;
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

module.exports = { JOB_TYPES, KEYS, MAX_ATTEMPTS, enqueue, reserveNext, complete, retryOrFail, requeueInterrupted };
