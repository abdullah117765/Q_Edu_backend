# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS deps

ENV NODE_ENV=development
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci


FROM deps AS builder

COPY nest-cli.json tsconfig*.json ./
COPY src ./src
COPY test ./test

RUN npx prisma generate \
  && npm run build


FROM node:22-bookworm-slim AS prod-deps

ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev \
  && npm install --no-save prisma@6.16.3 \
  && npx prisma generate \
  && npm cache clean --force


FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    PRISMA_MIGRATE_DEPLOY=true

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    openssl \
    tini \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system nodejs \
  && useradd --system --gid nodejs --home-dir /app nestjs

COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --chown=nestjs:nodejs package*.json ./
COPY --chown=nestjs:nodejs prisma ./prisma
COPY --chown=nestjs:nodejs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p storage/uploads \
  && chown -R nestjs:nodejs /app \
  && chmod +x /usr/local/bin/docker-entrypoint.sh

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD curl --fail "http://127.0.0.1:${PORT}/api/health" || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "docker-entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
