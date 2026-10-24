import pg from 'pg';
import { config } from './config.js';

let pool = null;

export function getPool() {
  if (!config.databaseUrl) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: config.databaseUrl,
      ssl: config.pgSsl ? { rejectUnauthorized: false } : false,
      max: 5, // keep it small on a 512 MB instance / free Postgres
      idleTimeoutMillis: 30_000,
    });
    pool.on('error', (err) => console.error('[db] idle client error', err.message));
  }
  return pool;
}

export async function migrate() {
  const db = getPool();
  if (!db) {
    console.warn('[db] DATABASE_URL not set — skipping migrations');
    return;
  }
  await db.query(`
    CREATE TABLE IF NOT EXISTS takes (
      id           UUID PRIMARY KEY,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      original_name TEXT,
      mime_type    TEXT,
      size_bytes   BIGINT,
      duration_sec REAL,
      width        INT,
      height       INT,
      status       TEXT NOT NULL DEFAULT 'uploaded',
      feedback     JSONB
    );
  `);
  console.log('[db] migrations applied');
}

export async function pingDb() {
  const db = getPool();
  if (!db) return 'not_configured';
  try {
    await db.query('SELECT 1');
    return 'ok';
  } catch (err) {
    return `error: ${err.message}`;
  }
}
