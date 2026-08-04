import { prisma } from "@repo/db";
import { WikimediaClient, OutreachDashboardClient } from "@repo/utils";
import { SyncService } from "../services";
import { OutreachSyncService } from "../services/outreach-sync.service";
import { OutreachArticleSyncService } from "../services/outreach-article-sync.service";
import { BootstrapService } from "../services/bootstrap.service";
import { FULL_SYNC_CHILD_JOB_TYPES } from "../services/sync.service";

const wikimediaClient = new WikimediaClient({
  baseUrl: "https://en.wikipedia.org",
});
const syncService = new SyncService(prisma, wikimediaClient);

const dashboardClient = new OutreachDashboardClient({
  baseUrl: "https://outreachdashboard.wmflabs.org",
});
const outreachSyncService = new OutreachSyncService(prisma, {
  baseUrl: "https://outreachdashboard.wmflabs.org",
});
const outreachArticleSyncService = new OutreachArticleSyncService(prisma, dashboardClient);

const resultCount = (job: { metadata: unknown } | null, key: "imported" | "updated") => {
  const metadata = job?.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return 0;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "number" ? value : 0;
};

const findOrCreateChild = async (rootJobId: string, jobType: string) => {
  const existing = await prisma.syncJob.findFirst({
    where: { parentJobId: rootJobId, jobType },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;
  return syncService.createSyncJob(jobType, rootJobId);
};

/** Execute or resume a bootstrap root job. Safe to call from a dedicated worker. */
export const runBootstrapJob = async (rootJobId: string) => {
  try {
    const root = await prisma.syncJob.findUnique({ where: { id: rootJobId } });
    if (!root || ["completed", "cancelled"].includes(root.status)) return;
    if (root.status !== "running") await syncService.startSyncJob(rootJobId);

    const editorsJob = await findOrCreateChild(rootJobId, "editors");
    let editorsSynced = resultCount(editorsJob, "imported") + resultCount(editorsJob, "updated");
    if (editorsJob.status !== "completed") {
      await syncService.updateParentJobProgress(
        rootJobId,
        "Syncing editors",
        FULL_SYNC_CHILD_JOB_TYPES,
      );
      const result = await outreachSyncService.syncEditorsFromDashboard("OKA", "OKA", {
        parentJobId: rootJobId,
        jobId: editorsJob.id,
      });
      editorsSynced = result.imported + result.updated;
    }
    await syncService.updateParentJobProgress(
      rootJobId,
      "Editors completed",
      FULL_SYNC_CHILD_JOB_TYPES,
    );

    const articlesJob = await findOrCreateChild(rootJobId, "outreach_articles");
    let articlesSynced = resultCount(articlesJob, "imported") + resultCount(articlesJob, "updated");
    if (articlesJob.status !== "completed") {
      await syncService.updateParentJobProgress(
        rootJobId,
        "Syncing outreach articles",
        FULL_SYNC_CHILD_JOB_TYPES,
      );
      const result = await outreachArticleSyncService.syncArticlesFromDashboard("OKA", "OKA", {
        parentJobId: rootJobId,
        jobId: articlesJob.id,
      });
      articlesSynced = result.imported + result.updated;
    }
    await syncService.updateParentJobProgress(
      rootJobId,
      "Outreach articles completed",
      FULL_SYNC_CHILD_JOB_TYPES,
    );

    const refreshedRoot = await prisma.syncJob.findUnique({ where: { id: rootJobId } });
    if (refreshedRoot?.status === "cancelled") return;

    // Remaining stages have their own idempotent upserts. They are created by
    // runFullSync only after editors/articles are complete.
    await syncService.runFullSync(
      rootJobId,
      { editorsSynced, articlesSynced },
      FULL_SYNC_CHILD_JOB_TYPES,
      "bootstrap_full",
    );
  } catch (error) {
    await syncService.failSyncJob(rootJobId, error);
    throw error;
  }
};

export const triggerBootstrapSync = async (bootstrapService: BootstrapService) => {
  const result = await bootstrapService.startBootstrap();
  if (!result.success) {
    console.log(
      `[Bootstrap] Cannot start: state=${result.state.state}, already running or completed`,
    );
    return null;
  }

  const job = await syncService.createSyncJob("full");
  await syncService.startSyncJob(job.id);
  await bootstrapService.setRootJobId(job.id);
  console.log(`[Bootstrap] Created durable full sync job ${job.id}`);
  return job;
};
