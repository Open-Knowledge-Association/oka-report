import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { prisma, checkDatabase } from "@repo/db";
import { BootstrapService } from "./services/bootstrap.service";
import { StatsService } from "./services/stats.service";
import { startScheduler } from "./jobs/scheduler";
import { SyncService } from "./services/sync.service";
import { OutreachSyncService } from "./services/outreach-sync.service";
import { OutreachArticleSyncService } from "./services/outreach-article-sync.service";
import { HistoricalPageviewService } from "./services/historical-pageview.service";
import { WikimediaClient, OutreachDashboardClient } from "@repo/utils";
import { runBootstrapJob, triggerBootstrapSync } from "./jobs/bootstrap-trigger";

const POLL_MS = 5000;
const LEASE_MS = 2 * 60 * 1000;
const WORKER_ID = process.env.WORKER_ID ?? `worker-${process.pid}`;
const bootstrapService = new BootstrapService(prisma);
const wikimediaClient = new WikimediaClient({ baseUrl: "https://en.wikipedia.org" });
const queuedSyncService = new SyncService(prisma, wikimediaClient);
const queuedOutreachService = new OutreachSyncService(prisma, { baseUrl: "https://outreachdashboard.wmflabs.org" });
const queuedDashboardClient = new OutreachDashboardClient({ baseUrl: "https://outreachdashboard.wmflabs.org" });
const queuedArticleService = new OutreachArticleSyncService(prisma, queuedDashboardClient);
const historicalPageviewService = new HistoricalPageviewService(prisma, wikimediaClient);
const queuedStatsService = new StatsService(prisma);
let executing = false;
let backfillForRoot: string | null = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const touchHeartbeat = () => writeFile("/tmp/oka-worker-heartbeat", new Date().toISOString()).catch(() => undefined);

const claimRoot = async (rootJobId: string) => {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE sync_jobs
    SET status = 'running',
        "startedAt" = COALESCE("startedAt", NOW()),
        "leaseOwner" = ${WORKER_ID},
        "leaseVersion" = "leaseVersion" + 1,
        "heartbeatAt" = NOW(),
        "leaseExpiresAt" = NOW() + (${LEASE_MS} * INTERVAL '1 millisecond')
    WHERE id = ${rootJobId}
      AND status IN ('pending', 'running')
      AND ("leaseOwner" IS NULL OR "leaseOwner" = ${WORKER_ID} OR "leaseExpiresAt" < NOW())
    RETURNING id
  `;
  return rows.length === 1;
};

const heartbeat = async (rootJobId: string) => {
  await prisma.$executeRaw`
    UPDATE sync_jobs
    SET "heartbeatAt" = NOW(),
        "leaseExpiresAt" = NOW() + (${LEASE_MS} * INTERVAL '1 millisecond')
    WHERE id = ${rootJobId} AND "leaseOwner" = ${WORKER_ID} AND status = 'running'
  `;
};

const processQueuedJob = async () => {
  const state = await bootstrapService.getState();
  const job = await prisma.syncJob.findFirst({
    where: {
      parentJobId: null,
      status: { in: ["pending", "running"] },
      ...(state?.rootJobId ? { NOT: { id: state.rootJobId } } : {}),
      jobType: { in: ["contributions", "pageviews", "commons", "editors", "outreach_articles", "history_backfill", "historical_pageviews"] },
    },
    orderBy: { createdAt: "asc" },
  });
  if (!job || (job.jobType === "historical_pageviews" && state?.state === "running") || !(await claimRoot(job.id))) return;
  try {
    const jobMetadata = job.metadata && typeof job.metadata === "object" && !Array.isArray(job.metadata)
      ? job.metadata as Record<string, unknown>
      : {};
    const school = typeof jobMetadata.school === "string" ? jobMetadata.school : "OKA";
    const slug = typeof jobMetadata.slug === "string" ? jobMetadata.slug : "OKA";
    const syncMode = typeof jobMetadata.mode === "string" ? jobMetadata.mode : "manual_full";
    if (job.jobType === "contributions") {
      const count = await queuedSyncService.syncEditorContributions(undefined, undefined, job.id);
      await queuedSyncService.completeSyncJob(job.id, { contributionsSynced: count });
    } else if (job.jobType === "pageviews") {
      const count = await queuedSyncService.syncArticlePageviews(undefined, undefined, job.id, syncMode as any);
      await queuedSyncService.completeSyncJob(job.id, { pageviewsSynced: count });
    } else if (job.jobType === "commons") {
      const count = await queuedSyncService.syncCommonsUploads(undefined, job.id);
      await queuedSyncService.completeSyncJob(job.id, { commonsUploadsSynced: count });
    } else if (job.jobType === "editors") {
      await queuedOutreachService.syncEditorsFromDashboard(school, slug, { parentJobId: job.parentJobId ?? undefined, jobId: job.id });
    } else if (job.jobType === "outreach_articles") {
      await queuedArticleService.syncArticlesFromDashboard(school, slug, { parentJobId: job.parentJobId ?? undefined, jobId: job.id });
    } else if (job.jobType === "history_backfill") {
      const metadata = job.metadata && typeof job.metadata === "object" && !Array.isArray(job.metadata) ? job.metadata as { startDate?: unknown; endDate?: unknown } : {};
      const startDate = new Date(String(metadata.startDate ?? ""));
      const endDate = new Date(String(metadata.endDate ?? ""));
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
        throw new Error("Invalid history backfill date range");
      }
      const result = await queuedStatsService.runHistoryBackfill(startDate, endDate, job.id);
      await queuedSyncService.completeSyncJob(job.id, result as any);
    } else if (job.jobType === "historical_pageviews") {
      const metadata = job.metadata && typeof job.metadata === "object" && !Array.isArray(job.metadata) ? job.metadata as { year?: unknown } : {};
      const year = Number(metadata.year ?? new Date().getUTCFullYear());
      const result = await historicalPageviewService.syncYear(year, job.id);
      await queuedSyncService.completeSyncJob(job.id, result as any);
    }
  } catch (error) {
    await queuedSyncService.failSyncJob(job.id, error);
    console.error(`[Worker] Queued job ${job.id} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const cycle = async () => {
  const bootstrap = new BootstrapService(prisma);
  await bootstrap.reconcileStaleRunningState();
  let state = await bootstrap.getState();

  if (!state || state.state === "pending") {
    await triggerBootstrapSync(bootstrap);
    state = await bootstrap.getState();
  }

  if (state?.state === "completed" && state.rootJobId && backfillForRoot !== state.rootJobId) {
    const rootJobId = state.rootJobId;
    backfillForRoot = rootJobId;
    console.log(`[Worker] Starting non-blocking post-bootstrap daily stats backfill for ${rootJobId}`);
    void new StatsService(prisma).backfillMissingDailySnapshots()
      .then(() => console.log(`[Worker] Post-bootstrap daily stats backfill completed for ${rootJobId}`))
      .catch((error) => {
        console.error(`[Worker] Backfill failed: ${error instanceof Error ? error.message : String(error)}`);
        backfillForRoot = null;
      });
  }

  await processQueuedJob();

  if (!executing) {
    const scheduledRoot = await prisma.syncJob.findFirst({
      where: {
        parentJobId: null,
        jobType: "full",
        status: { in: ["pending", "running"] },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    const rootJobId = state?.state === "running" && state.rootJobId
      ? state.rootJobId
      : scheduledRoot?.id;
    if (rootJobId) {
      executing = true;
      if (!(await claimRoot(rootJobId))) {
        executing = false;
        return;
      }
      const timer = setInterval(() => void heartbeat(rootJobId), 30000);
      try {
        console.log(`[Worker] Claimed/resuming root job ${rootJobId} as ${WORKER_ID}`);
        await runBootstrapJob(rootJobId);
      } catch (error) {
        console.error(`[Worker] Root job failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
      } finally {
        clearInterval(timer);
        executing = false;
      }
    }
  }
};

const main = async () => {
  await checkDatabase();
  await touchHeartbeat();
  setInterval(() => void touchHeartbeat(), 10_000);
  console.log("[Worker] Database connection verified");
  startScheduler();
  console.log("[Worker] Scheduler started");
  while (true) {
    try {
      await cycle();
    } catch (error) {
      console.error(`[Worker] Cycle error: ${error instanceof Error ? error.message : String(error)}`);
    }
    await sleep(POLL_MS);
  }
};

void main();
