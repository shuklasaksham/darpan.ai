# syntax=docker/dockerfile:1

# ---------- 1. Build the React app ----------
FROM node:22-bookworm-slim AS app-build
WORKDIR /build/app
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
RUN npm run build

# ---------- 2. Install server production deps ----------
FROM node:22-bookworm-slim AS server-deps
WORKDIR /build/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# ---------- 3. Runtime ----------
FROM node:22-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=10000 \
    UPLOAD_DIR=/tmp/darpan-uploads \
    # Keep the V8 heap well under the 512 MB instance so ffmpeg has room to run.
    NODE_OPTIONS=--max-old-space-size=256

WORKDIR /srv/server
COPY --from=server-deps /build/server/node_modules ./node_modules
COPY server/ ./
COPY --from=app-build /build/app/dist ./public

RUN mkdir -p /tmp/darpan-uploads && chown -R node:node /tmp/darpan-uploads
USER node

EXPOSE 10000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "src/index.js"]
