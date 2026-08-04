import { Hono } from "hono";
import type { Context, Next } from "hono";
import { articlesRoutes } from "./articles";
import { authRoutes } from "./auth";
import { bootstrapRoutes } from "./bootstrap";
import { editorsRoutes } from "./editors";
import { healthRoutes } from "./health";
import { schedulerRoutes } from "./scheduler";
import { statsRoutes } from "./stats";
import { syncRoutes } from "./sync";
import { outreachRoutes } from "./outreach";

export const apiRoutes = new Hono();

// Read endpoints remain public. Every mutating operational endpoint requires
// the server-side ops token; authentication endpoints are intentionally exempt.
apiRoutes.use("*", async (c, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(c.req.method) || c.req.path.startsWith("/api/auth")) {
    return next();
  }
  const expected = process.env.OPS_TOKEN;
  const supplied = c.req.header("x-oka-ops-token");
  if (!expected || !supplied || supplied !== expected) {
    return c.json({ success: false, error: { code: "OPS_AUTH_REQUIRED", message: "Operational token required" } }, 401);
  }
  return next();
});

// Public-open deployment: every application route is reachable anonymously.
const publicOpenMiddleware = async (_c: Context, next: Next) => next();

// Public routes - no authentication required
apiRoutes.route("/auth", authRoutes);
apiRoutes.route("/health", healthRoutes);

// Public read routes; writes remain authenticated.
apiRoutes.use("/articles", publicOpenMiddleware);
apiRoutes.use("/articles/*", publicOpenMiddleware);
apiRoutes.route("/articles", articlesRoutes);

// Bootstrap, scheduler, sync, and admin operations remain protected.
apiRoutes.use("/bootstrap", publicOpenMiddleware);
apiRoutes.use("/bootstrap/*", publicOpenMiddleware);
apiRoutes.route("/bootstrap", bootstrapRoutes);

apiRoutes.use("/editors", publicOpenMiddleware);
apiRoutes.use("/editors/*", publicOpenMiddleware);
apiRoutes.route("/editors", editorsRoutes);

apiRoutes.use("/scheduler", publicOpenMiddleware);
apiRoutes.use("/scheduler/*", publicOpenMiddleware);
apiRoutes.route("/scheduler", schedulerRoutes);

apiRoutes.use("/stats", publicOpenMiddleware);
apiRoutes.use("/stats/*", publicOpenMiddleware);
apiRoutes.route("/stats", statsRoutes);

apiRoutes.use("/sync", publicOpenMiddleware);
apiRoutes.use("/sync/*", publicOpenMiddleware);
apiRoutes.route("/sync", syncRoutes);

apiRoutes.use("/outreach", publicOpenMiddleware);
apiRoutes.use("/outreach/*", publicOpenMiddleware);
apiRoutes.route("/outreach", outreachRoutes);
