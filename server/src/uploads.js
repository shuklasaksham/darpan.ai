import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { config } from './config.js';

fs.mkdirSync(config.uploadDir, { recursive: true });

// diskStorage streams each chunk to a file as it arrives. Never use memoryStorage here:
// one 100 MB reel would eat a fifth of the instance's RAM.
const storage = multer.diskStorage({
  destination: config.uploadDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase().slice(0, 8) || '.bin';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

export const uploadVideo = multer({
  storage,
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) return cb(null, true);
    cb(Object.assign(new Error('Only video or audio files are allowed'), { status: 415 }));
  },
}).single('video');

export async function removeQuietly(...files) {
  await Promise.all(files.filter(Boolean).map((f) => fsp.rm(f, { force: true }).catch(() => {})));
}

/** Periodically deletes stale uploads so the disk doesn't fill up. */
export function startUploadSweeper() {
  const sweep = async () => {
    try {
      const now = Date.now();
      for (const name of await fsp.readdir(config.uploadDir)) {
        const file = path.join(config.uploadDir, name);
        const { mtimeMs } = await fsp.stat(file).catch(() => ({ mtimeMs: now }));
        if (now - mtimeMs > config.uploadTtlMs) await removeQuietly(file);
      }
    } catch (err) {
      console.error('[uploads] sweep failed', err.message);
    }
  };
  const timer = setInterval(sweep, 10 * 60 * 1000);
  timer.unref();
  sweep();
}
