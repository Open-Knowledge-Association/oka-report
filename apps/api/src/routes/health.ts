import { Hono } from "hono";
import { checkDatabase } from "@repo/db";

export const healthRoutes = new Hono();

healthRoutes.get("/", async (c) => {
  try {
    await checkDatabase();
    return c.json({ success: true, status: "ok" }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json(
      {
        success: false,
        status: "db_unavailable",
        error: message,
      },
      503,
    );
  }
});
