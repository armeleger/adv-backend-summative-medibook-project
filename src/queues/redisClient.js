// Redis connections. Created lazily so that modules (and unit tests) can be
// loaded without a Redis server running.
const Redis = require('ioredis');
const env = require('../config/env');

let sharedClient = null;

function createClient(name, options = {}) {
  const client = new Redis(env.redisUrl, {
    // Fail a command after a couple of reconnect attempts instead of hanging
    // an HTTP request forever while Redis is down.
    maxRetriesPerRequest: 2,
    ...options,
  });
  let lastError = null;
  client.on('error', (err) => {
    if (err.message !== lastError) console.error(`[redis:${name}] ${err.message}`);
    lastError = err.message;
  });
  client.on('ready', () => { lastError = null; });
  return client;
}

// General-purpose client for normal commands.
function getRedis() {
  if (!sharedClient) sharedClient = createClient('main');
  return sharedClient;
}

// Blocking commands (BLMOVE) hold their connection, so the worker uses a
// dedicated client for them; it waits through Redis restarts.
function createBlockingClient() {
  return createClient('blocking', { maxRetriesPerRequest: null });
}

async function closeRedis() {
  if (sharedClient) {
    await sharedClient.quit().catch(() => sharedClient.disconnect());
    sharedClient = null;
  }
}

module.exports = { getRedis, createBlockingClient, closeRedis };
