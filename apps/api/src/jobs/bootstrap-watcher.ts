import type { PrismaClient } from "@repo/db/generated/prisma/client";
import type { BootstrapService } from "../services/bootstrap.service";

const POLL_INTERVAL_MS = 10000; // 10 seconds

export const startBootstrapWatcher = (prisma: PrismaClient, bootstrapService: BootstrapService) => {
  let stopped = false;

  const watchLoop = async () => {
    if (stopped) {
      return;
    }

    try {
      const state = await bootstrapService.getState();

      if (!state || state.state !== "running" || !state.rootJobId) {
        setTimeout(watchLoop, POLL_INTERVAL_MS);
        return;
      }

      const rootJob = await prisma.syncJob.findUnique({
        where: { id: state.rootJobId },
      });

      if (!rootJob) {
        console.warn(
          `[BootstrapWatcher] Root job ${state.rootJobId} not found - marking bootstrap failed`,
        );
        await bootstrapService.failBootstrap("Root job not found");
        setTimeout(watchLoop, POLL_INTERVAL_MS);
        return;
      }

      if (rootJob.status === "completed") {
        console.log(
          `[BootstrapWatcher] Root job ${state.rootJobId} completed - marking bootstrap complete`,
        );
        await bootstrapService.completeBootstrap();
      } else if (rootJob.status === "failed") {
        const reason = rootJob.error ?? "Root job failed";
        console.warn(
          `[BootstrapWatcher] Root job ${state.rootJobId} failed - marking bootstrap failed: ${reason}`,
        );
        await bootstrapService.failBootstrap(reason);
      } else if (rootJob.status === "cancelled") {
        console.warn(
          `[BootstrapWatcher] Root job ${state.rootJobId} cancelled - marking bootstrap failed`,
        );
        await bootstrapService.failBootstrap("Root job cancelled");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[BootstrapWatcher] Error during watch cycle: ${message}`);
    }

    setTimeout(watchLoop, POLL_INTERVAL_MS);
  };

  watchLoop();

  return () => {
    stopped = true;
  };
};
