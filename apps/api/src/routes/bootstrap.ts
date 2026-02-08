import { Hono } from "hono";
import { BootstrapService } from "../services/bootstrap.service";
import { prisma } from "@repo/db";

export const bootstrapRoutes = new Hono();
const bootstrapService = new BootstrapService(prisma);

bootstrapRoutes.get("/status", async (c) => {
  const state = await bootstrapService.getState();
  if (!state) {
    return c.json({ success: true, data: null });
  }
  return c.json({
    success: true,
    data: {
      state: state.state,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      leaseExpiresAt: state.leaseExpiresAt,
      rootJobId: state.rootJobId,
      failedAt: state.failedAt,
      failureReason: state.failureReason,
      isLeaseExpired: await bootstrapService.isLeaseExpired(),
    },
  });
});

bootstrapRoutes.post("/retry", async (c) => {
  const result = await bootstrapService.retryFailedBootstrap();
  return c.json({ success: result.success, data: result.state });
});
