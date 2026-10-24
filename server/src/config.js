import os from 'node:os';
import path from 'node:path';

const mb = (n) => n * 1024 * 1024;

export const config = {
  port: Number(process.env.PORT) || 3000,
  isProd: process.env.NODE_ENV === 'production',

  databaseUrl: process.env.DATABASE_URL || '',
  // Render's internal connection string doesn't need SSL; the external one does.
  // Set PGSSL=true when connecting from outside Render (e.g. local dev against Render Postgres).
  pgSsl: process.env.PGSSL === 'true',

  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  deepgramApiKey: process.env.DEEPGRAM_API_KEY || '',
  sarvamApiKey: process.env.SARVAM_API_KEY || '',

  // Uploads stream straight to disk — never buffered in RAM (512 MB instance).
  uploadDir: process.env.UPLOAD_DIR || path.join(os.tmpdir(), 'darpan-uploads'),
  maxUploadBytes: mb(Number(process.env.MAX_UPLOAD_MB) || 200),
  // Delete uploaded files older than this. Render's disk is ephemeral anyway.
  uploadTtlMs: (Number(process.env.UPLOAD_TTL_MINUTES) || 60) * 60 * 1000,

  staticDir: process.env.STATIC_DIR || path.resolve(import.meta.dirname, '../public'),
};

export const keyStatus = () => ({
  database: Boolean(config.databaseUrl),
  anthropic: Boolean(config.anthropicApiKey),
  deepgram: Boolean(config.deepgramApiKey),
  sarvam: Boolean(config.sarvamApiKey),
});
