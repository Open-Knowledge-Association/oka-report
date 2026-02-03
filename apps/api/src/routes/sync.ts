import { Hono } from "hono";
import { prisma } from "@repo/db";
import { WikimediaClient } from "@repo/utils";
import { OutreachDashboardClient } from "@repo/utils/src/outreach-dashboard";
import { TriggerSyncSchema, OutreachSyncSchema } from "../schemas";
import { SyncService } from "../services";
import { OutreachSyncService } from "../services/outreach-sync.service";

const wikimediaClient = new WikimediaClient({
  baseUrl: "https://en.wikipedia.org",
});
const syncService = new SyncService(prisma, wikimediaClient);

const outreachSyncService = new OutreachSyncService(prisma, {
  baseUrl: "https://outreachdashboard.wmflabs.org",
});

export const syncRoutes = new Hono();

syncRoutes.post("/trigger", async (c) => {
  const body = TriggerSyncSchema.parse(await c.req.json());
  const jobType = body.jobType ?? "full";

  const job = await syncService.createSyncJob(jobType);
  await syncService.startSyncJob(job.id);

  setTimeout(async () => {
    try {
      if (jobType === "contributions") {
        const contributionsSynced = await syncService.syncEditorContributions();
        await syncService.completeSyncJob(job.id, { contributionsSynced });
        return;
      }
      if (jobType === "pageviews") {
        const pageviewsSynced = await syncService.syncArticlePageviews();
        await syncService.completeSyncJob(job.id, { pageviewsSynced });
        return;
      }
      if (jobType === "commons") {
        const commonsUploadsSynced = await syncService.syncCommonsUploads();
        await syncService.completeSyncJob(job.id, { commonsUploadsSynced });
        return;
      }

      await syncService.runFullSync();
    } catch (error) {
      await syncService.failSyncJob(job.id, error);
    }
  }, 0);

  return c.json({ success: true, data: job }, 202);
});

syncRoutes.get("/status", async (c) => {
  const latest = await prisma.syncJob.findFirst({
    orderBy: { createdAt: "desc" },
  });

  return c.json({ success: true, data: latest });
});

syncRoutes.get("/history", async (c) => {
  const limit = Number(c.req.query("limit") ?? 10);
  const jobType = c.req.query("jobType");

  const history = await prisma.syncJob.findMany({
    where: jobType ? { jobType } : {},
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return c.json({ success: true, data: history });
});

/**
 * POST /api/sync/outreach
 * Trigger sync of editors from Outreach Dashboard
 * Body: { school, slug }
 * Returns: { success: boolean, data: { jobId, status } }
 * Status: 202 Accepted
 */
syncRoutes.post("/outreach", async (c) => {
  try {
    const body = OutreachSyncSchema.parse(await c.req.json());

    const job = await prisma.syncJob.create({
      data: {
        jobType: "editors",
        status: "pending",
      },
    });

    setTimeout(async () => {
      try {
        const result = await outreachSyncService.syncEditorsFromDashboard(body.school, body.slug);

        await prisma.syncJob.update({
          where: { id: job.id },
          data: {
            status: "completed",
            completedAt: new Date(),
            metadata: result as any,
          },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Outreach sync failed:", errorMessage);

        await prisma.syncJob.update({
          where: { id: job.id },
          data: {
            status: "failed",
            completedAt: new Date(),
            error: errorMessage,
          },
        });
      }
    }, 0);

    return c.json(
      {
        success: true,
        data: {
          jobId: job.id,
          status: "accepted",
        },
      },
      202,
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return c.json(
        {
          success: false,
          error: "Invalid request body",
        },
        400,
      );
    }

    if (error instanceof Error && error.name === "ZodError") {
      return c.json(
        {
          success: false,
          error: "Validation error",
          details: error.message,
        },
        400,
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error("Error triggering outreach sync:", message);

    return c.json(
      {
        success: false,
        error: "Failed to trigger sync",
        details: message,
      },
      500,
    );
  }
});
