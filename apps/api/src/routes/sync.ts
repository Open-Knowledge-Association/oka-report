import { Hono } from "hono";
import { prisma } from "@repo/db";
import { WikimediaClient } from "@repo/utils";
import { TriggerSyncSchema } from "../schemas";
import { SyncService } from "../services";

const wikimediaClient = new WikimediaClient({
  baseUrl: "https://en.wikipedia.org",
});
const syncService = new SyncService(prisma, wikimediaClient);

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
