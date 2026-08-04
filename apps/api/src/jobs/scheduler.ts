import cron from "node-cron";
import { prisma, checkDatabase } from "@repo/db";
import { WikimediaClient, OutreachDashboardClient } from "@repo/utils";
import { StatsService, SyncService } from "../services";
import { OutreachArticleSyncService } from "../services/outreach-article-sync.service";
import { BootstrapService } from "../services/bootstrap.service";

const schedule = process.env.SYNC_SCHEDULE ?? "0 2 * * *";
const outreachSchool = process.env.OUTREACH_SCHOOL ?? "OKA";
const outreachSlug = process.env.OUTREACH_SLUG ?? "OKA";
const outreachSchedule = process.env.OUTREACH_ARTICLE_SYNC_SCHEDULE ?? "0 3 * * *";

export const startScheduler = () => {
  const wikimediaClient = new WikimediaClient({
    baseUrl: "https://en.wikipedia.org",
  });
  const syncService = new SyncService(prisma, wikimediaClient);
  const statsService = new StatsService(prisma);
  const bootstrapService = new BootstrapService(prisma);

  const getScheduleSetting = async (id: string) => {
    return prisma.schedulerSetting.findUnique({ where: { id } });
  };

  const isScheduleEnabled = async (id: string) => {
    const setting = await getScheduleSetting(id);
    return setting?.enabled ?? true;
  };

  const hasActiveHeavyJob = async () => Boolean(await prisma.syncJob.findFirst({
    where: {
      status: { in: ["pending", "running"] },
      jobType: { in: ["full", "contributions", "pageviews", "commons", "outreach_articles"] },
    },
    select: { id: true, jobType: true },
  }));

  const ensureDatabase = async (jobLabel: string) => {
    try {
      await checkDatabase();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[Scheduler] Skipping ${jobLabel}: database unavailable (${message})`);
      return false;
    }
  };

  cron.schedule(schedule, async () => {
    const setting = await getScheduleSetting("full-sync");
    if (setting && !setting.enabled) {
      console.log(
        `[Scheduler] Skipping full sync: disabled${setting.disabledReason ? ` (${setting.disabledReason})` : ""}`,
      );
      return;
    }
    const bootstrapState = await bootstrapService.getState();
    if (!bootstrapState || bootstrapState.state !== "completed") {
      console.log(
        `[Scheduler] Skipping full-sync: bootstrap incomplete (state: ${bootstrapState?.state || "unknown"})`,
      );
      return;
    }
    if (await hasActiveHeavyJob()) {
      console.log("[Scheduler] Skipping full sync: another heavy sync is active");
      return;
    }
    if (!(await ensureDatabase("full sync"))) {
      return;
    }
    try {
      // Queue only. The durable worker owns the ordered pipeline:
      // editors -> Outreach articles -> contributions -> pageviews -> Commons.
      const job = await syncService.createSyncJob("full");
      console.log(`[Scheduler] Queued durable full sync ${job.id}`);
    } catch (error) {
      console.error("Scheduled sync queue failed", error);
    }
  });

  const dashboardClient = new OutreachDashboardClient({
    baseUrl: "https://outreachdashboard.wmflabs.org",
  });
  const outreachArticleSyncService = new OutreachArticleSyncService(prisma, dashboardClient);

  cron.schedule(outreachSchedule, async () => {
    const setting = await getScheduleSetting("outreach-articles");
    if (setting && !setting.enabled) {
      console.log(
        `[Scheduler] Skipping outreach article sync: disabled${setting.disabledReason ? ` (${setting.disabledReason})` : ""}`,
      );
      return;
    }
    const bootstrapState = await bootstrapService.getState();
    if (!bootstrapState || bootstrapState.state !== "completed") {
      console.log(
        `[Scheduler] Skipping outreach-articles: bootstrap incomplete (state: ${bootstrapState?.state || "unknown"})`,
      );
      return;
    }
    console.log(
      `[Scheduler] Starting outreach article sync (school=${outreachSchool}, slug=${outreachSlug})`,
    );
    if (await hasActiveHeavyJob()) {
      console.log("[Scheduler] Skipping outreach article sync: another heavy sync is active");
      return;
    }
    if (!(await ensureDatabase("outreach article sync"))) {
      return;
    }
    try {
      const result = await outreachArticleSyncService.syncArticlesFromDashboard(
        outreachSchool,
        outreachSlug,
      );
      console.log(
        `[Scheduler] Outreach article sync completed: ${result.imported} imported, ${result.updated} updated, ${result.errors} errors`,
      );
    } catch (error) {
      console.error("[Scheduler] Outreach article sync failed:", error);
    }
  });

  cron.schedule("15 0 * * *", async () => {
    const setting = await getScheduleSetting("daily-stats");
    if (setting && !setting.enabled) {
      console.log(
        `[Scheduler] Skipping daily stats snapshot: disabled${setting.disabledReason ? ` (${setting.disabledReason})` : ""}`,
      );
      return;
    }
    const bootstrapState = await bootstrapService.getState();
    if (!bootstrapState || bootstrapState.state !== "completed") {
      console.log(
        `[Scheduler] Skipping daily-stats: bootstrap incomplete (state: ${bootstrapState?.state || "unknown"})`,
      );
      return;
    }
    if (!(await ensureDatabase("daily stats snapshot"))) {
      return;
    }

    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    try {
      await statsService.recordDailySnapshot(yesterday);
      console.log("[Scheduler] Daily stats snapshot completed");
    } catch (error) {
      console.error("[Scheduler] Daily stats snapshot failed:", error);
    }
  });

  cron.schedule("30 0 * * *", async () => {
    const setting = await getScheduleSetting("daily-backfill");
    if (setting && !setting.enabled) {
      console.log(
        `[Scheduler] Skipping daily stats backfill: disabled${setting.disabledReason ? ` (${setting.disabledReason})` : ""}`,
      );
      return;
    }
    const bootstrapState = await bootstrapService.getState();
    if (!bootstrapState || bootstrapState.state !== "completed") {
      console.log(
        `[Scheduler] Skipping daily-backfill: bootstrap incomplete (state: ${bootstrapState?.state || "unknown"})`,
      );
      return;
    }
    if (!(await ensureDatabase("daily stats backfill"))) {
      return;
    }

    try {
      await statsService.backfillMissingDailySnapshots();
      console.log("[Scheduler] Daily stats backfill completed");
    } catch (error) {
      console.error("[Scheduler] Daily stats backfill failed:", error);
    }
  });

  console.log(`[Scheduler] Outreach article sync scheduled: ${outreachSchedule}`);
};
