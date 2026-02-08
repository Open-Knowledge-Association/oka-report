import { Hono } from "hono";
import { articlesRoutes } from "./articles";
import { authRoutes } from "./auth";
import { bootstrapRoutes } from "./bootstrap";
import { editorsRoutes } from "./editors";
import { healthRoutes } from "./health";
import { schedulerRoutes } from "./scheduler";
import { statsRoutes } from "./stats";
import { syncRoutes } from "./sync";
import { outreachRoutes } from "./outreach";
import { authMiddleware } from "../middleware/auth";

export const apiRoutes = new Hono();

// Public routes - no authentication required
apiRoutes.route("/auth", authRoutes);
apiRoutes.route("/health", healthRoutes);

// Protected routes - require authentication
apiRoutes.use("/articles/*", authMiddleware);
apiRoutes.route("/articles", articlesRoutes);

apiRoutes.use("/bootstrap/*", authMiddleware);
apiRoutes.route("/bootstrap", bootstrapRoutes);

apiRoutes.use("/editors/*", authMiddleware);
apiRoutes.route("/editors", editorsRoutes);

apiRoutes.use("/scheduler/*", authMiddleware);
apiRoutes.route("/scheduler", schedulerRoutes);

apiRoutes.use("/stats/*", authMiddleware);
apiRoutes.route("/stats", statsRoutes);

apiRoutes.use("/sync/*", authMiddleware);
apiRoutes.route("/sync", syncRoutes);

apiRoutes.use("/outreach/*", authMiddleware);
apiRoutes.route("/outreach", outreachRoutes);
