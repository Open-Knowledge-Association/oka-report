import { Hono } from "hono";
import { articlesRoutes } from "./articles";
import { bootstrapRoutes } from "./bootstrap";
import { editorsRoutes } from "./editors";
import { healthRoutes } from "./health";
import { schedulerRoutes } from "./scheduler";
import { statsRoutes } from "./stats";
import { syncRoutes } from "./sync";
import { outreachRoutes } from "./outreach";

export const apiRoutes = new Hono();

// Public-open deployment: all application routes, including mutations and
// operational controls, are intentionally available without authentication.
apiRoutes.route("/health", healthRoutes);

apiRoutes.route("/articles", articlesRoutes);
apiRoutes.route("/bootstrap", bootstrapRoutes);
apiRoutes.route("/editors", editorsRoutes);
apiRoutes.route("/scheduler", schedulerRoutes);
apiRoutes.route("/stats", statsRoutes);
apiRoutes.route("/sync", syncRoutes);
apiRoutes.route("/outreach", outreachRoutes);
