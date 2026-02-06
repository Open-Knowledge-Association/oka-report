import { Hono } from "hono";
import { articlesRoutes } from "./articles";
import { editorsRoutes } from "./editors";
import { healthRoutes } from "./health";
import { schedulerRoutes } from "./scheduler";
import { statsRoutes } from "./stats";
import { syncRoutes } from "./sync";
import { outreachRoutes } from "./outreach";

export const apiRoutes = new Hono();

apiRoutes.route("/articles", articlesRoutes);
apiRoutes.route("/editors", editorsRoutes);
apiRoutes.route("/health", healthRoutes);
apiRoutes.route("/scheduler", schedulerRoutes);
apiRoutes.route("/stats", statsRoutes);
apiRoutes.route("/sync", syncRoutes);
apiRoutes.route("/outreach", outreachRoutes);
