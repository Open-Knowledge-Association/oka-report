FROM oven/bun:1.3.5 AS base

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/utils/package.json ./packages/utils/

RUN bun install --frozen-lockfile

COPY . .

RUN bun run db:generate

WORKDIR /app/apps/web
RUN bun run build

FROM nginx:alpine AS production

COPY --from=base /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
