import { Hono } from "hono";
import "dotenv/config";
import { apiRoutes } from "./routes";
import { errorHandler } from "./middleware/error-handler";
import { prisma, checkDatabase } from "@repo/db";
import { BootstrapService } from "./services/bootstrap.service";
import { startBootstrapWatcher } from "./jobs/bootstrap-watcher";
import { triggerBootstrapSync } from "./jobs/bootstrap-trigger";

const app = new Hono();

app.onError(errorHandler);
app.route("/api", apiRoutes);

app.get("/", (c) => {
  return c.json({ message: "OKA Stats API" });
});

const initializeServer = async () => {
  try {
    await checkDatabase();
    console.log("[Server] Database connection verified");

    const bootstrapService = new BootstrapService(prisma);

    await bootstrapService.reconcileStaleRunningState();
    console.log("[Server] Bootstrap state reconciled");

    const state = await bootstrapService.getState();

    if (!state || state.state === "pending") {
      console.log("[Server] Bootstrap pending - triggering first-deploy sync");
      await triggerBootstrapSync(bootstrapService);
    } else if (state.state === "failed") {
      console.warn(
        `[Server] Bootstrap failed previously: ${state.failureReason ?? "unknown"}. Manual retry required.`,
      );
    } else if (state.state === "running") {
      console.log(
        `[Server] Bootstrap running (job ${state.rootJobId}) - watcher will monitor completion`,
      );
    } else if (state.state === "completed") {
      console.log("[Server] Bootstrap completed - scheduled jobs enabled");
    }

    startBootstrapWatcher(prisma, bootstrapService);
    console.log("[Server] Bootstrap watcher started");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Server] Initialization error: ${message}`);
  }
};

initializeServer();

// Export app for tests
export { app };

// Export Bun server config with increased timeout for large payloads
export default {
  port: 3000,
  fetch: app.fetch,
  idleTimeout: 60,
};
