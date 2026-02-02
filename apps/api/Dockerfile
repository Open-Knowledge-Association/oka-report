# syntax=docker/dockerfile:1

FROM oven/bun:1.3.5 AS base

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/utils/package.json ./packages/utils/

RUN bun install --frozen-lockfile

COPY . .

RUN bun run db:generate

WORKDIR /app/apps/api
RUN bun build --compile --outfile=./oka-api ./src/index.ts

FROM debian:bookworm-slim AS production

WORKDIR /app

COPY --from=base /app/apps/api/oka-api ./

EXPOSE 3000

CMD ["./oka-api"]
