import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { config, keyStatus } from './config.js';
import { getPool, migrate, pingDb } from './db.js';
import { ffmpegVersion, probe } from './media.js';
import { uploadVideo, removeQuietly, startUploadSweeper } from './uploads.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Render sits behind a proxy
app.use(express.json({ limit: '1mb' }));

// ---------- API ----------

app.get('/api/health', async (_req, res) => {
  const [db, ffmpeg] = await Promise.all([pingDb(), ffmpegVersion()]);
  const mem = process.memoryUsage();
  res.json({
    ok: true,
    db,
    ffmpeg: ffmpeg ?? 'missing',
    keys: keyStatus(), // booleans only — never echo secrets
    memoryMb: { rss: Math.round(mem.rss / 1e6), heapUsed: Math.round(mem.heapUsed / 1e6) },
  });
});

// Upload a take. The file lands on disk; we probe it with ffprobe and record it.
app.post('/api/takes', uploadVideo, async (req, res, next) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file. Send multipart field "video".' });
  let meta;
  try {
    meta = await probe(file.path);
  } catch {
    await removeQuietly(file.path);
    return res.status(422).json({ error: "Couldn't read that video. Try recording again." });
  }
  try {
    const id = path.parse(file.filename).name;
    const db = getPool();
    if (db) {
      await db.query(
        `INSERT INTO takes (id, original_name, mime_type, size_bytes, duration_sec, width, height)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, file.originalname, file.mimetype, file.size, meta.durationSec, meta.width, meta.height],
      );
    }
    // TODO: extractAudio → Deepgram/Sarvam transcript → Claude coaching feedback.
    res.status(201).json({ id, sizeBytes: file.size, ...meta });
  } catch (err) {
    await removeQuietly(file.path);
    next(err);
  }
});

app.get('/api/takes/:id', async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Database not configured' });
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: 'Bad id' });
  const { rows } = await db.query('SELECT * FROM takes WHERE id = $1', [req.params.id]);
  rows[0] ? res.json(rows[0]) : res.status(404).json({ error: 'Not found' });
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// ---------- Static app (built by Vite) ----------

if (fs.existsSync(config.staticDir)) {
  app.use(
    express.static(config.staticDir, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );
  // SPA fallback
  app.get(/.*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(config.staticDir, 'index.html'));
  });
} else {
  console.warn(`[static] ${config.staticDir} not found — run the app build (dev: use Vite on :5173)`);
}

// ---------- Errors ----------

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ error: err.message, code: err.code });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Internal error' : err.message });
});

// ---------- Boot ----------

await migrate().catch((err) => console.error('[db] migration failed:', err.message));
startUploadSweeper();

const server = app.listen(config.port, () => {
  console.log(`Darpan server on :${config.port} (uploads → ${config.uploadDir})`);
  console.log('[keys]', keyStatus());
});

// Large phone uploads over mobile data can be slow.
server.requestTimeout = 10 * 60 * 1000;

const shutdown = () => {
  server.close(() => getPool()?.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(0), 10_000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
