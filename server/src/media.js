import { spawn } from 'node:child_process';

function run(cmd, args, { timeoutMs = 30_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      code === 0 ? resolve(out) : reject(new Error(err.trim() || `${cmd} exited ${code}`));
    });
  });
}

export async function ffmpegVersion() {
  try {
    const out = await run('ffmpeg', ['-hide_banner', '-version'], { timeoutMs: 5000 });
    return out.split('\n')[0];
  } catch {
    return null;
  }
}

/** Reads duration + video dimensions from a file on disk. */
export async function probe(filePath) {
  const out = await run('ffprobe', [
    '-v', 'error',
    '-print_format', 'json',
    '-show_entries', 'format=duration:stream=codec_type,width,height',
    filePath,
  ]);
  const data = JSON.parse(out);
  const video = (data.streams || []).find((s) => s.codec_type === 'video');
  const duration = Number(data.format?.duration);
  return {
    durationSec: Number.isFinite(duration) ? duration : null,
    width: video?.width ?? null,
    height: video?.height ?? null,
    hasAudio: (data.streams || []).some((s) => s.codec_type === 'audio'),
  };
}

/**
 * Extracts a 16 kHz mono WAV — the format speech-to-text APIs (Deepgram, Sarvam) handle best.
 * ffmpeg streams file-to-file, so memory stays flat regardless of video size.
 */
export async function extractAudio(inputPath, outputPath) {
  await run('ffmpeg', ['-y', '-i', inputPath, '-vn', '-ac', '1', '-ar', '16000', '-f', 'wav', outputPath], {
    timeoutMs: 120_000,
  });
  return outputPath;
}
