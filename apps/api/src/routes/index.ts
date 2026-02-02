import { Hono } from "hono";
import { editorsRoutes } from "./editors";
import { statsRoutes } from "./stats";
import { syncRoutes } from "./sync";

export const apiRoutes = new Hono();

apiRoutes.route("/editors", editorsRoutes);
apiRoutes.route("/stats", statsRoutes);
apiRoutes.route("/sync", syncRoutes);
