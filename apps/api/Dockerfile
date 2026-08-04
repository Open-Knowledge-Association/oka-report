# syntax=docker/dockerfile:1

FROM oven/bun:1.3.5 AS base

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/utils/package.json ./packages/utils/

RUN bun install --frozen-lockfile

COPY . .
COPY apps/api/src/healthcheck.ts /app/healthcheck.ts
COPY apps/api/src/worker-healthcheck.ts /app/worker-healthcheck.ts

RUN cd packages/db && bunx prisma generate

WORKDIR /app/apps/api
RUN bun build --compile --outfile=./oka-api ./src/index.ts
RUN bun build --compile --outfile=./oka-worker ./src/worker.ts
RUN bun build --compile --outfile=./oka-api-healthcheck ../../healthcheck.ts
RUN bun build --compile --outfile=./oka-worker-healthcheck ../../worker-healthcheck.ts

FROM debian:bookworm-slim AS production

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

COPY --from=base /app/apps/api/oka-api ./
COPY --from=base /app/apps/api/oka-worker ./
COPY --from=base /app/apps/api/oka-api-healthcheck ./
COPY --from=base /app/apps/api/oka-worker-healthcheck ./

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["./oka-api-healthcheck"]

EXPOSE 3000

CMD ["./oka-api"]
