import cron from "node-cron";
import { prisma } from "@repo/db";
import { WikimediaClient } from "@repo/utils";
import { SyncService } from "../services";

const schedule = process.env.SYNC_SCHEDULE ?? "0 2 * * *";

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
};
