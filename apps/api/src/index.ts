import { Hono } from "hono";
import "dotenv/config";
import { apiRoutes } from "./routes";
import { errorHandler } from "./middleware/error-handler";
import { startScheduler } from "./jobs/scheduler";

const app = new Hono();

app.onError(errorHandler);
app.route("/api", apiRoutes);

app.get("/", (c) => {
  return c.json({ message: "OKA Stats API" });
});

startScheduler();

// Export app for tests
export { app };

// Export Bun server config with increased timeout for large payloads
export default {
  port: 3000,
  fetch: app.fetch,
  idleTimeout: 60,
};
// Force rebuild Kam 05 Feb 2026 19:18:25 WIB
