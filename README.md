# Darpan

An AI director for creators — a phone web app that coaches first-time Indian creators while they shoot reels.

```
app/      React + Vite (mobile-first web app)
server/   Node + Express API; serves the built app in production
Dockerfile  builds app → copies dist into server/public → runs server with ffmpeg installed
render.yaml Render Blueprint (web service + Postgres)
```

## Local dev

Needs Node 22+ and ffmpeg (`brew install ffmpeg` / `sudo apt install ffmpeg`).

```bash
cp .env.example .env        # fill in keys
npm run install:all
npm run dev:server          # API on :3000
npm run dev:app             # Vite on :5173, proxies /api → :3000
```

Open the Vite "Network" URL on your phone (same Wi-Fi) to test recording. Note that
some phone browsers only allow camera capture over HTTPS, so test real capture on Render.

## Docker

```bash
docker build -t darpan .
docker run --rm -p 10000:10000 --env-file .env darpan
```

## Deploy on Render

1. Render dashboard → **New → Blueprint** → select this repo. `render.yaml` creates the
   `darpan` web service and the `darpan-db` Postgres, and wires `DATABASE_URL` (internal URL).
2. Enter `ANTHROPIC_API_KEY`, `DEEPGRAM_API_KEY`, `SARVAM_API_KEY` when prompted.
3. Check `https://<your-service>.onrender.com/api/health` — it reports DB, ffmpeg and which keys
   are set (booleans only).

Prefer setting it up by hand? Create a Docker web service from the repo, a Render Postgres
instance, and add the four env vars above.

## Environment

| Var | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Render Postgres internal URL |
| `ANTHROPIC_API_KEY` | yes | Claude — coaching feedback |
| `DEEPGRAM_API_KEY` | yes | Speech-to-text |
| `SARVAM_API_KEY` | yes | Indian-language speech/text |
| `PGSSL` | no | `true` when connecting from outside Render (external URL) |
| `UPLOAD_DIR` | no | default `/tmp/darpan-uploads` |
| `MAX_UPLOAD_MB` | no | default `200` |
| `UPLOAD_TTL_MINUTES` | no | stale uploads are swept after this, default `60` |

## Memory budget (512 MB)

- Uploads use multer **diskStorage** — each chunk is written to disk as it arrives, nothing is
  buffered in RAM. Never switch to `memoryStorage`.
- Video work goes through ffmpeg/ffprobe as child processes reading from disk (`server/src/media.js`),
  so Node's heap stays flat regardless of file size.
- `NODE_OPTIONS=--max-old-space-size=256` caps the V8 heap, leaving headroom for ffmpeg.
- Render's disk is ephemeral: treat `UPLOAD_DIR` as scratch space. A sweeper deletes files older
  than `UPLOAD_TTL_MINUTES`. Persist results (transcripts, feedback) in Postgres.

## API

- `GET /api/health` — DB, ffmpeg, key presence, memory
- `POST /api/takes` — multipart field `video`; saves to disk, probes with ffprobe, records in `takes`
- `GET /api/takes/:id`

Next up: `extractAudio()` → Deepgram / Sarvam transcript → Claude director's notes.
