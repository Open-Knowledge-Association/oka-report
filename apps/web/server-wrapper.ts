import server from "./dist/server/server.js";

const port = Number(process.env.PORT ?? 3000);
const clientRoot = "/app/dist/client";

Bun.serve({
  port,
  hostname: process.env.HOST ?? "0.0.0.0",
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/assets/v2/") || url.pathname === "/favicon.ico") {
      const assetPath = url.pathname.startsWith("/assets/v2/")
        ? url.pathname.slice("/assets/v2".length)
        : url.pathname;
      const file = Bun.file(`${clientRoot}/assets/v2${assetPath}`);
      if (await file.exists()) {
        return new Response(file);
      }
      return new Response("Not Found", { status: 404 });
    }
    return server.fetch(request);
  },
});

console.log(`Started SSR/static server on port ${port}`);
