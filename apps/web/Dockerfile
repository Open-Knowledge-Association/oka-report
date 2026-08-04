# syntax=docker/dockerfile:1
FROM oven/bun:1.3.5 AS base
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/utils/package.json ./packages/utils/
RUN bun install --frozen-lockfile

COPY . .
RUN cd packages/db && bunx prisma generate

WORKDIR /app/apps/web
RUN bun run build

FROM oven/bun:1.3.5-slim AS production
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/utils/package.json ./packages/utils/
RUN bun install --frozen-lockfile --production
RUN cd apps/web && bun install --frozen-lockfile --production
RUN for p in node_modules/.bun/*/node_modules/*; do \
      n=${p##*/}; \
      if [ "${n#@}" != "$n" ]; then \
        mkdir -p "node_modules/$n"; \
        for q in "$p"/*; do m=${q##*/}; [ -e "node_modules/$n/$m" ] || ln -s "/app/$q" "node_modules/$n/$m"; done; \
      elif [ "$n" != ".bin" ]; then \
        [ -e "node_modules/$n" ] || ln -s "/app/$p" "node_modules/$n"; \
      fi; \
    done
COPY --from=base /app/apps/web/dist ./dist
COPY apps/web/server-wrapper.ts ./server-wrapper.ts
EXPOSE 3000
CMD ["bun", "./server-wrapper.ts"]
