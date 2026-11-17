// Recreates the medibook database from database/schema.sql and loads
// database/seed.sql. Equivalent to:
//   mysql -u root -p < database/schema.sql && mysql -u root -p < database/seed.sql
// Usage: npm run db:setup            (schema + seed)
//        npm run db:setup -- --no-seed (schema only)
require('dotenv').config({ quiet: true });
const fs = require('node:fs/promises');
const path = require('node:path');
const mysql = require('mysql2/promise');

const DATABASE_DIR = path.join(__dirname, '..', 'database');

async function runSqlFile(connection, fileName) {
  const sql = await fs.readFile(path.join(DATABASE_DIR, fileName), 'utf8');
  await connection.query(sql);
  console.log(`Ran database/${fileName}`);
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });
  try {
    await runSqlFile(connection, 'schema.sql');
    if (!process.argv.includes('--no-seed')) {
      await runSqlFile(connection, 'seed.sql');
    }
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error(`Database setup failed: ${err.message}`);
  process.exitCode = 1;
});
