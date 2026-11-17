// Web server entry point:  npm start
const app = require('./app');
const env = require('./config/env');
const db = require('./models/db');
const { closeRedis } = require('./queues/redisClient');
const auditLogger = require('./utils/auditLogger');

async function start() {
  await auditLogger.init(); // creates logs/ on first run
  await db.ping(); // fail fast with a clear message if MySQL is not reachable

  const server = app.listen(env.port, () => {
    console.log(`MediBook API listening on http://localhost:${env.port}`);
  });

  const shutdown = () => {
    console.log('Shutting down...');
    server.close(async () => {
      await Promise.allSettled([db.close(), closeRedis()]);
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error(`Failed to start MediBook API: ${err.message}`);
  console.error('Check that MySQL is running and the DB_* values in .env are correct.');
  process.exit(1);
});
