// Waitlists in Redis, one per doctor per day:
//   medibook:waitlist:<doctorId>:<YYYY-MM-DD>          LIST  of JSON entries (FIFO)
//   medibook:waitlist:<doctorId>:<YYYY-MM-DD>:members  SET   of patient ids (no duplicates)
// Both keys expire the day after the appointment day, when they are useless.
const { getRedis } = require('./redisClient');

const waitlistKey = (doctorId, day) => `medibook:waitlist:${doctorId}:${day}`;
const membersKey = (doctorId, day) => `${waitlistKey(doctorId, day)}:members`;

// Atomic "add unless already waiting": SADD and RPUSH run as one Lua script,
// so the list and the set can never disagree. Returns 0 if already present,
// otherwise the new list length (= the patient's position).
const ADD_SCRIPT = `
  if redis.call('SADD', KEYS[2], ARGV[1]) == 0 then
    return 0
  end
  local length = redis.call('RPUSH', KEYS[1], ARGV[2])
  redis.call('EXPIREAT', KEYS[1], ARGV[3])
  redis.call('EXPIREAT', KEYS[2], ARGV[3])
  return length
`;

async function add(entry, expireAtSeconds) {
  const position = await getRedis().eval(
    ADD_SCRIPT,
    2,
    waitlistKey(entry.doctorId, entry.day),
    membersKey(entry.doctorId, entry.day),
    String(entry.patientId),
    JSON.stringify(entry),
    expireAtSeconds,
  );
  return position === 0 ? { added: false } : { added: true, position };
}

// Returns [{ raw, entry }] in queue order without removing anything.
async function list(doctorId, day) {
  const raws = await getRedis().lrange(waitlistKey(doctorId, day), 0, -1);
  return raws.map((raw) => ({ raw, entry: JSON.parse(raw) }));
}

// Removes one exact entry from both the list and the member set.
async function remove(doctorId, day, raw, patientId) {
  await getRedis()
    .multi()
    .lrem(waitlistKey(doctorId, day), 1, raw)
    .srem(membersKey(doctorId, day), String(patientId))
    .exec();
}

// Removes a patient's entry by patient id (used when a patient leaves the
// waitlist). Lua keeps the find + LREM + SREM atomic. Returns true if removed.
const REMOVE_PATIENT_SCRIPT = `
  local entries = redis.call('LRANGE', KEYS[1], 0, -1)
  for _, raw in ipairs(entries) do
    local entry = cjson.decode(raw)
    if tostring(entry.patientId) == ARGV[1] then
      redis.call('LREM', KEYS[1], 1, raw)
      redis.call('SREM', KEYS[2], ARGV[1])
      return 1
    end
  end
  return 0
`;

async function removePatient(doctorId, day, patientId) {
  const removed = await getRedis().eval(
    REMOVE_PATIENT_SCRIPT,
    2,
    waitlistKey(doctorId, day),
    membersKey(doctorId, day),
    String(patientId),
  );
  return removed === 1;
}

// Is the patient still waiting? (They may have left after the worker read the list.)
async function isWaiting(doctorId, day, patientId) {
  return (await getRedis().sismember(membersKey(doctorId, day), String(patientId))) === 1;
}

module.exports = { add, list, remove, removePatient, isWaiting };
