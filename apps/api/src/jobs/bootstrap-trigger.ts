import { prisma, checkDatabase } from "@repo/db";
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

  console.log(`[Bootstrap] Started full sync with root job ${job.id}`);

  setTimeout(async () => {
    try {
      await syncService.updateParentJobProgress(
        job.id,
        "Starting full sync",
        FULL_SYNC_CHILD_JOB_TYPES,
      );

      await syncService.updateParentJobProgress(
        job.id,
        "Syncing editors",
        FULL_SYNC_CHILD_JOB_TYPES,
      );
      const editorsResult = await outreachSyncService.syncEditorsFromDashboard("OKA", "OKA", {
        parentJobId: job.id,
      });
      await syncService.updateParentJobProgress(
        job.id,
        "Editors completed",
        FULL_SYNC_CHILD_JOB_TYPES,
      );

      await syncService.updateParentJobProgress(
        job.id,
        "Syncing outreach articles",
        FULL_SYNC_CHILD_JOB_TYPES,
      );
      const articlesResult = await outreachArticleSyncService.syncArticlesFromDashboard(
        "OKA",
        "OKA",
        { parentJobId: job.id },
      );
      await syncService.updateParentJobProgress(
        job.id,
        "Outreach articles completed",
        FULL_SYNC_CHILD_JOB_TYPES,
      );

      await syncService.runFullSync(
        job.id,
        {
          editorsSynced: editorsResult.imported + editorsResult.updated,
          articlesSynced: articlesResult.imported + articlesResult.updated,
        },
        FULL_SYNC_CHILD_JOB_TYPES,
      );
    } catch (error) {
      await syncService.failSyncJob(job.id, error);
    }
  }, 0);

  return job;
};
