import cron from "node-cron";
import { prisma } from "@repo/db";
import { WikimediaClient, OutreachDashboardClient } from "@repo/utils";
import { SyncService } from "../services";
import { OutreachArticleSyncService } from "../services/outreach-article-sync.service";

const schedule = process.env.SYNC_SCHEDULE ?? "0 2 * * *";
const outreachSchool = process.env.OUTREACH_SCHOOL ?? "OKA";
const outreachSlug = process.env.OUTREACH_SLUG ?? "OKA";
const outreachSchedule = process.env.OUTREACH_ARTICLE_SYNC_SCHEDULE ?? "0 3 * * *";

export const startScheduler = () => {
  const wikimediaClient = new WikimediaClient({
    baseUrl: "https://en.wikipedia.org",
  });
  const syncService = new SyncService(prisma, wikimediaClient);

  cron.schedule(schedule, async () => {
    try {
      await syncService.runFullSync();
    } catch (error) {
      console.error("Scheduled sync failed", error);
    }
  });

  const dashboardClient = new OutreachDashboardClient({
    baseUrl: "https://outreachdashboard.wmflabs.org",
  });
  const outreachArticleSyncService = new OutreachArticleSyncService(prisma, dashboardClient);

  cron.schedule(outreachSchedule, async () => {
    console.log(
      `[Scheduler] Starting outreach article sync (school=${outreachSchool}, slug=${outreachSlug})`,
    );
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

  console.log(`[Scheduler] Outreach article sync scheduled: ${outreachSchedule}`);
};
