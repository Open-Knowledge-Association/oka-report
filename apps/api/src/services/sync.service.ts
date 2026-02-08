import type { Prisma, PrismaClient } from "@repo/db/generated/prisma/client";
import type { CommonsUpload, UserContribution } from "@repo/utils";
import { WikimediaClient, WikimediaClientError } from "@repo/utils";

type SyncMode = "bootstrap_full" | "scheduled_incremental" | "manual_full" | "manual_backfill";

type SyncSummary = {
  editorsSynced?: number;
  articlesSynced?: number;
  contributionsSynced: number;
  pageviewsSynced: number;
  commonsUploadsSynced: number;
};

type PreSyncStats = {
  editorsSynced?: number;
  articlesSynced?: number;
};

type SyncJobLogLevel = "info" | "success" | "error";

type SyncJobLogEntry = {
  at: string;
  level: SyncJobLogLevel;
  message: string;
};

export const FULL_SYNC_CHILD_JOB_TYPES = [
  "editors",
  "outreach_articles",
  "contributions",
  "pageviews",
  "commons",
] as const;

const bytesToWords = (bytesChanged: number) => Math.max(0, Math.floor(bytesChanged / 6));

const toPageviewsProject = (wikiProject: string) => wikiProject.replace(/\.org$/, "");

const addUtcDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const startOfUtcDay = (date: Date) => {
  const next = new Date(date);
  next.setUTCHours(0, 0, 0, 0);
  return next;
};

const formatDateForPageviews = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

const parsePageviewDate = (date: string) => new Date(`${date}T00:00:00Z`);

const formatDateForMetadata = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export class SyncService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly wikimediaClient: WikimediaClient,
  ) {}

  async findActiveJob(jobType: string) {
    return this.prisma.syncJob.findFirst({
      where: {
        jobType,
        status: { in: ["running", "pending"] },
      },
      orderBy: { startedAt: "desc" },
    });
  }

  private buildChildJobStatusMap(
    childJobs: Array<{ id: string; jobType: string; status: string }>,
  ): Record<string, { id: string; status: string }> {
    const statusMap: Record<string, { id: string; status: string }> = {};
    for (const childJob of childJobs) {
      statusMap[childJob.jobType] = {
        id: childJob.id,
        status: childJob.status,
      };
    }
    return statusMap;
  }

  private toMetadataObject(metadata: Prisma.JsonValue | null | undefined): Prisma.InputJsonObject {
    if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
      return metadata as Prisma.InputJsonObject;
    }
    return {};
  }

  private extractMetadataLogs(metadata: Prisma.InputJsonObject): SyncJobLogEntry[] {
    const rawLogs = metadata.logs;
    if (!Array.isArray(rawLogs)) {
      return [];
    }

    return rawLogs
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => {
        const at = typeof item.at === "string" ? item.at : new Date().toISOString();
        const level =
          item.level === "success" || item.level === "error" || item.level === "info"
            ? item.level
            : "info";
        const message = typeof item.message === "string" ? item.message : "-";
        return { at, level, message };
      });
  }

  private async updateJobMetadata(
    jobId: string,
    patch: Prisma.InputJsonObject,
    log?: { message: string; level?: SyncJobLogLevel },
  ) {
    const existingJob = await this.prisma.syncJob.findUnique({
      where: { id: jobId },
      select: { metadata: true },
    });

    const existingMetadata = this.toMetadataObject(existingJob?.metadata);
    const existingLogs = this.extractMetadataLogs(existingMetadata);

    const nextLogs = [...existingLogs];
    if (log?.message) {
      nextLogs.push({
        at: new Date().toISOString(),
        level: log.level ?? "info",
        message: log.message,
      });
    }

    const mergedMetadataBase: Prisma.InputJsonObject = {
      ...existingMetadata,
      ...patch,
    };

    const mergedMetadata =
      nextLogs.length > 0
        ? {
            ...mergedMetadataBase,
            logs: nextLogs.slice(-200) as unknown as Prisma.InputJsonArray,
          }
        : mergedMetadataBase;

    await this.prisma.syncJob.update({
      where: { id: jobId },
      data: { metadata: mergedMetadata as Prisma.InputJsonObject },
    });
  }

  async updateParentJobProgress(
    parentJobId: string,
    stage?: string,
    childJobTypes: readonly string[] = FULL_SYNC_CHILD_JOB_TYPES,
  ) {
    const childJobs = await this.prisma.syncJob.findMany({
      where: { parentJobId },
      select: { id: true, jobType: true, status: true },
    });

    const completedStatuses = new Set(["completed", "failed", "cancelled"]);
    const processed = childJobs.filter((job) => completedStatuses.has(job.status)).length;
    const children = this.buildChildJobStatusMap(childJobs);

    await this.updateJobMetadata(
      parentJobId,
      {
        totalExpected: childJobTypes.length,
        processed,
        stage,
        children,
      },
      stage ? { message: stage } : undefined,
    );
  }

  /**
   * Check if a job has been cancelled and update its status if so.
   * Returns true if cancelled (caller should stop processing).
   */
  private async checkCancelled(jobId: string): Promise<boolean> {
    const job = await this.prisma.syncJob.findUnique({
      where: { id: jobId },
    });
    if (!job) {
      return false;
    }
    if (job?.status === "cancelled") {
      await this.prisma.syncJob.update({
        where: { id: jobId },
        data: {
          status: "cancelled",
          completedAt: new Date(),
        },
      });
      return true;
    }
    if (job.parentJobId) {
      const parentJob = await this.prisma.syncJob.findUnique({
        where: { id: job.parentJobId },
      });
      if (parentJob?.status === "cancelled") {
        await this.prisma.syncJob.update({
          where: { id: jobId },
          data: {
            status: "cancelled",
            completedAt: new Date(),
          },
        });
        return true;
      }
    }
    return false;
  }

  async syncEditorContributions(editorId?: string, since?: Date, jobId?: string) {
    const editors = await this.prisma.editor.findMany({
      where: {
        isActive: true,
        ...(editorId ? { id: editorId } : {}),
      },
    });

    const wikiProjects = await this.getContributionWikiProjects();
    const wikiClients = new Map(
      wikiProjects.map((wikiProject) => [
        wikiProject,
        new WikimediaClient({ baseUrl: `https://${wikiProject}` }),
      ]),
    );

    let syncedCount = 0;
    const totalEditors = editors.length;
    let processedEditors = 0;
    const checkpointInterval = 10;

    if (jobId) {
      await this.updateJobMetadata(
        jobId,
        {
          total: totalEditors,
          processed: processedEditors,
          syncedCount,
          stage: `Syncing contributions (0/${totalEditors} editors)`,
        },
        { message: `Syncing contributions (0/${totalEditors} editors)` },
      );
    }

    for (const editor of editors) {
      if (jobId && (await this.checkCancelled(jobId))) {
        await this.updateJobMetadata(
          jobId,
          {
            total: totalEditors,
            processed: processedEditors,
            syncedCount,
            stage: "Cancelled by user",
          },
          { message: "Cancelled by user", level: "error" },
        );
        return syncedCount;
      }

      if (jobId) {
        await this.updateJobMetadata(
          jobId,
          {
            total: totalEditors,
            processed: processedEditors,
            syncedCount,
            stage: `Syncing contributions (${processedEditors}/${totalEditors} editors) - ${editor.username}`,
            currentEditor: editor.username,
          },
          { message: `Processing editor: ${editor.username}` },
        );
      }

      for (const wikiProject of wikiProjects) {
        const wikiClient = wikiClients.get(wikiProject);
        if (!wikiClient) {
          continue;
        }

        if (jobId) {
          await this.updateJobMetadata(jobId, {
            currentEditor: editor.username,
            currentWikiProject: wikiProject,
            stage: `Syncing contributions (${processedEditors}/${totalEditors} editors) - ${editor.username} @ ${wikiProject}`,
          });
        }

        const contributions = await wikiClient.getUserContributions(
          editor.username,
          since ? { start: since.toISOString() } : {},
        );

        for (const contribution of contributions) {
          const article = await this.findArticleForContribution(contribution, wikiProject);
          if (!article) {
            continue;
          }

          const isCreation = contribution.parentId == null || contribution.parentId === 0;

          await this.prisma.contribution.upsert({
            where: {
              revisionId_articleId: {
                revisionId: contribution.revisionId,
                articleId: article.id,
              },
            },
            create: {
              editorId: editor.id,
              articleId: article.id,
              revisionId: contribution.revisionId,
              parentId: contribution.parentId,
              bytesChanged: contribution.sizeDiff,
              wordsAdded: bytesToWords(contribution.sizeDiff),
              isCreation,
              editTimestamp: new Date(contribution.timestamp),
            },
            update: {},
          });

          if (isCreation && !article.createdByEditorId) {
            await this.prisma.article.update({
              where: { id: article.id },
              data: { createdByEditorId: editor.id },
            });
          }

          syncedCount += 1;
        }
      }

      processedEditors += 1;

      if (
        jobId &&
        (processedEditors % checkpointInterval === 0 || processedEditors === totalEditors)
      ) {
        await this.updateJobMetadata(
          jobId,
          {
            total: totalEditors,
            processed: processedEditors,
            syncedCount,
            stage: `Syncing contributions (${processedEditors}/${totalEditors} editors)`,
          },
          {
            message: `Contributions progress: ${processedEditors}/${totalEditors} editors, ${syncedCount} contributions`,
          },
        );

        console.log(
          `Contributions sync progress: ${processedEditors}/${totalEditors} editors, ${syncedCount} contributions synced`,
        );
      }
    }

    if (jobId) {
      await this.updateJobMetadata(
        jobId,
        {
          total: totalEditors,
          processed: processedEditors,
          syncedCount,
          stage: `Completed contributions sync (${processedEditors}/${totalEditors} editors)`,
        },
        {
          message: `Completed contributions sync (${processedEditors}/${totalEditors} editors), ${syncedCount} contributions`,
          level: "success",
        },
      );
    }

    return syncedCount;
  }

  async syncArticlePageviews(
    articleId?: string,
    since?: Date,
    jobId?: string,
    mode: SyncMode = "manual_full",
  ) {
    // Concurrency guard: prevent parallel pageviews jobs
    const activeJob = await this.findActiveJob("pageviews");
    if (activeJob && (!jobId || activeJob.id !== jobId)) {
      console.log(`[Pageviews] Skipping: job ${activeJob.id} already running`);
      return 0;
    }

    const articles = await this.prisma.article.findMany({
      where: {
        ...(articleId ? { id: articleId } : {}),
        OR: [
          { createdByEditorId: { not: null } },
          { contributions: { some: { editor: { isActive: true } } } },
        ],
      },
      distinct: ["id"],
      include: {
        pageviews: {
          where: {
            type: "DAILY",
            agentType: "ALL_AGENTS",
          },
          orderBy: { date: "desc" },
          take: 1,
          select: { date: true },
        },
      },
    });

    let syncedCount = 0;
    const skipped404: { title: string; wikiProject: string; agentType: string }[] = [];
    const checkpointInterval = 10;
    const totalArticles = articles.length;
    const totalAgentRequests = totalArticles * 2;
    let processedArticles = 0;
    let processedAgentRequests = 0;

    const defaultStartDate =
      mode === "scheduled_incremental"
        ? startOfUtcDay(addUtcDays(new Date(), -30))
        : startOfUtcDay(addUtcDays(new Date(), -30));
    const endDate = startOfUtcDay(addUtcDays(new Date(), -1));

    if (jobId) {
      await this.updateJobMetadata(
        jobId,
        {
          totalArticles,
          processedArticles,
          totalAgentRequests,
          processedAgentRequests,
          syncedCount,
          skipped404Count: skipped404.length,
          stage: `Syncing pageviews (0/${totalArticles} articles)`,
        },
        { message: `Syncing pageviews (0/${totalArticles} articles)` },
      );
    }

    for (const article of articles) {
      if (jobId && (await this.checkCancelled(jobId))) {
        await this.updateJobMetadata(
          jobId,
          {
            totalArticles,
            processedArticles,
            totalAgentRequests,
            processedAgentRequests,
            syncedCount,
            skipped404Count: skipped404.length,
            skipped404Sample: skipped404.slice(0, 10),
            stage: "Cancelled by user",
          },
          { message: "Cancelled by user", level: "error" },
        );
        return syncedCount;
      }

      const latestSyncedDate = article.pageviews?.[0]?.date;
      const resolvedStartDate = startOfUtcDay(
        since
          ? since
          : latestSyncedDate
            ? addUtcDays(latestSyncedDate, 1)
            : (article.articleCreatedAt ?? defaultStartDate),
      );

      if (resolvedStartDate > endDate) {
        processedAgentRequests += 2;
        processedArticles += 1;

        if (
          jobId &&
          (processedArticles % checkpointInterval === 0 || processedArticles === totalArticles)
        ) {
          await this.updateJobMetadata(
            jobId,
            {
              totalArticles,
              processedArticles,
              totalAgentRequests,
              processedAgentRequests,
              syncedCount,
              skipped404Count: skipped404.length,
              skipped404Sample: skipped404.slice(0, 10),
              stage: `Syncing pageviews (${processedArticles}/${totalArticles} articles)`,
            },
            {
              message: `Pageviews progress: ${processedArticles}/${totalArticles} articles, ${syncedCount} rows, ${skipped404.length} 404`,
            },
          );

          console.log(
            `Pageview sync progress: ${processedArticles}/${totalArticles} articles, ${syncedCount} rows synced, ${skipped404.length} 404 responses`,
          );
        }

        continue;
      }

      for (const agentType of ["all-agents", "user"] as const) {
        let pageviews: Array<{ date: string; views: number }>;
        try {
          pageviews = await this.wikimediaClient.getPageviews(
            article.title,
            toPageviewsProject(article.wikiProject),
            formatDateForPageviews(resolvedStartDate),
            formatDateForPageviews(endDate),
            agentType,
          );
        } catch (error) {
          if (error instanceof WikimediaClientError && error.status === 404) {
            skipped404.push({
              title: article.title,
              wikiProject: article.wikiProject,
              agentType,
            });
            processedAgentRequests += 1;
            continue;
          }
          throw error;
        }

        for (const item of pageviews) {
          await this.prisma.pageview.upsert({
            where: {
              articleId_date_type_agentType: {
                articleId: article.id,
                date: parsePageviewDate(item.date),
                type: "DAILY",
                agentType: agentType === "user" ? "USER" : "ALL_AGENTS",
              },
            },
            create: {
              articleId: article.id,
              date: parsePageviewDate(item.date),
              type: "DAILY",
              agentType: agentType === "user" ? "USER" : "ALL_AGENTS",
              views: item.views,
            },
            update: {
              views: item.views,
            },
          });
          syncedCount += 1;
        }

        processedAgentRequests += 1;
      }

      processedArticles += 1;

      if (
        jobId &&
        (processedArticles % checkpointInterval === 0 || processedArticles === totalArticles)
      ) {
        await this.updateJobMetadata(
          jobId,
          {
            totalArticles,
            processedArticles,
            totalAgentRequests,
            processedAgentRequests,
            syncedCount,
            skipped404Count: skipped404.length,
            skipped404Sample: skipped404.slice(0, 10),
            stage: `Syncing pageviews (${processedArticles}/${totalArticles} articles)`,
          },
          {
            message: `Pageviews progress: ${processedArticles}/${totalArticles} articles, ${syncedCount} rows, ${skipped404.length} 404`,
          },
        );

        console.log(
          `Pageview sync progress: ${processedArticles}/${totalArticles} articles, ${syncedCount} rows synced, ${skipped404.length} 404 responses`,
        );
      }
    }

    if (jobId) {
      await this.updateJobMetadata(
        jobId,
        {
          totalArticles,
          processedArticles,
          totalAgentRequests,
          processedAgentRequests,
          syncedCount,
          skipped404Count: skipped404.length,
          skipped404Sample: skipped404.slice(0, 10),
          stage: `Completed pageviews sync (${processedArticles}/${totalArticles} articles)`,
        },
        {
          message: `Completed pageviews sync (${processedArticles}/${totalArticles} articles), ${syncedCount} rows`,
          level: "success",
        },
      );
      console.log(
        `Pageview sync completed: ${syncedCount} rows synced, ${skipped404.length} article/agent combinations returned 404`,
      );
    }

    return syncedCount;
  }

  async syncCommonsUploads(editorId?: string, jobId?: string) {
    const editors = await this.prisma.editor.findMany({
      where: {
        isActive: true,
        ...(editorId ? { id: editorId } : {}),
      },
    });

    let syncedCount = 0;
    const totalEditors = editors.length;
    let processedEditors = 0;
    const checkpointInterval = 10;

    if (jobId) {
      await this.updateJobMetadata(
        jobId,
        {
          total: totalEditors,
          processed: processedEditors,
          syncedCount,
          stage: `Syncing commons uploads (0/${totalEditors} editors)`,
        },
        { message: `Syncing commons uploads (0/${totalEditors} editors)` },
      );
    }

    for (const editor of editors) {
      if (jobId && (await this.checkCancelled(jobId))) {
        await this.updateJobMetadata(
          jobId,
          {
            total: totalEditors,
            processed: processedEditors,
            syncedCount,
            stage: "Cancelled by user",
          },
          { message: "Cancelled by user", level: "error" },
        );
        return syncedCount;
      }

      const uploads = await this.wikimediaClient.getCommonsUploads(editor.username);
      await this.storeCommonsUploads(editor.id, uploads);
      syncedCount += uploads.length;
      processedEditors += 1;

      if (
        jobId &&
        (processedEditors % checkpointInterval === 0 || processedEditors === totalEditors)
      ) {
        await this.updateJobMetadata(
          jobId,
          {
            total: totalEditors,
            processed: processedEditors,
            syncedCount,
            stage: `Syncing commons uploads (${processedEditors}/${totalEditors} editors)`,
          },
          {
            message: `Commons progress: ${processedEditors}/${totalEditors} editors, ${syncedCount} uploads`,
          },
        );

        console.log(
          `Commons sync progress: ${processedEditors}/${totalEditors} editors, ${syncedCount} uploads synced`,
        );
      }
    }

    if (jobId) {
      await this.updateJobMetadata(
        jobId,
        {
          total: totalEditors,
          processed: processedEditors,
          syncedCount,
          stage: `Completed commons sync (${processedEditors}/${totalEditors} editors)`,
        },
        {
          message: `Completed commons sync (${processedEditors}/${totalEditors} editors), ${syncedCount} uploads`,
          level: "success",
        },
      );
    }

    return syncedCount;
  }

  async createSyncJob(jobType: string, parentJobId?: string) {
    return this.prisma.syncJob.create({
      data: {
        jobType,
        status: "pending",
        parentJobId,
      },
    });
  }

  async startSyncJob(jobId: string) {
    const job = await this.prisma.syncJob.update({
      where: { id: jobId },
      data: { status: "running", startedAt: new Date() },
    });
    await this.updateJobMetadata(jobId, {}, { message: "Job started" });
    return job;
  }

  async completeSyncJob(jobId: string, metadata?: Prisma.InputJsonObject) {
    if (metadata) {
      await this.updateJobMetadata(jobId, metadata);
    }

    const job = await this.prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        completedAt: new Date(),
      },
    });
    await this.updateJobMetadata(jobId, {}, { message: "Job completed", level: "success" });
    return job;
  }

  async cancelSyncJob(jobId: string, metadata?: Prisma.InputJsonObject) {
    if (metadata) {
      await this.updateJobMetadata(jobId, metadata);
    }

    const job = await this.prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: "cancelled",
        completedAt: new Date(),
      },
    });
    await this.updateJobMetadata(jobId, {}, { message: "Job cancelled", level: "error" });
    return job;
  }

  async failSyncJob(jobId: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const job = await this.prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        completedAt: new Date(),
        error: message,
      },
    });
    await this.updateJobMetadata(jobId, {}, { message: `Job failed: ${message}`, level: "error" });
    return job;
  }

  async runFullSync(
    existingJobId?: string,
    preSyncStats?: PreSyncStats,
    childJobTypes: readonly string[] = FULL_SYNC_CHILD_JOB_TYPES,
    mode: SyncMode = "bootstrap_full",
  ): Promise<SyncSummary> {
    const jobId = existingJobId ?? (await this.createSyncJob("full")).id;
    if (!existingJobId) {
      await this.startSyncJob(jobId);
    }

    const editorsSynced = preSyncStats?.editorsSynced;
    const articlesSynced = preSyncStats?.articlesSynced;

    let contributionsSynced = 0;
    let pageviewsSynced = 0;
    let commonsUploadsSynced = 0;

    // Determine sync windows based on mode
    let contributionsSince: Date | undefined;
    let pageviewsSince: Date | undefined;

    if (mode === "scheduled_incremental") {
      // For scheduled incremental: contributions from last 30 days
      const now = new Date();
      contributionsSince = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      // For pageviews, we'll resolve it per-article in syncArticlePageviews
      pageviewsSince = undefined;
    } else if (mode === "manual_backfill") {
      // Manual backfill uses passed-in since date (would be provided separately)
      contributionsSince = undefined;
      pageviewsSince = undefined;
    } else {
      // bootstrap_full and manual_full: full historical
      contributionsSince = undefined;
      pageviewsSince = undefined;
    }

    // Record sync mode and window in metadata
    const windowStart = contributionsSince ? formatDateForMetadata(contributionsSince) : undefined;
    const windowEnd =
      mode === "scheduled_incremental" ? formatDateForMetadata(new Date()) : undefined;

    try {
      if (await this.checkCancelled(jobId)) {
        return {
          editorsSynced,
          articlesSynced,
          contributionsSynced,
          pageviewsSynced,
          commonsUploadsSynced,
        };
      }

      await this.updateParentJobProgress(jobId, "Syncing contributions", childJobTypes);
      const contributionsJob = await this.createSyncJob("contributions", jobId);
      await this.startSyncJob(contributionsJob.id);
      try {
        contributionsSynced = await this.syncEditorContributions(
          undefined,
          contributionsSince,
          contributionsJob.id,
        );
      } catch (error) {
        await this.failSyncJob(contributionsJob.id, error);
        await this.updateParentJobProgress(jobId, "Contributions failed", childJobTypes);
        throw error;
      }
      if (await this.checkCancelled(contributionsJob.id)) {
        await this.cancelSyncJob(contributionsJob.id, { contributionsSynced });
        await this.updateParentJobProgress(jobId, "Contributions cancelled", childJobTypes);
        return {
          editorsSynced,
          articlesSynced,
          contributionsSynced,
          pageviewsSynced,
          commonsUploadsSynced,
        };
      }
      await this.completeSyncJob(contributionsJob.id, { contributionsSynced });
      await this.updateParentJobProgress(jobId, "Contributions completed", childJobTypes);

      if (await this.checkCancelled(jobId)) {
        return {
          editorsSynced,
          articlesSynced,
          contributionsSynced,
          pageviewsSynced,
          commonsUploadsSynced,
        };
      }

      await this.updateParentJobProgress(jobId, "Syncing pageviews", childJobTypes);
      const pageviewsJob = await this.createSyncJob("pageviews", jobId);
      await this.startSyncJob(pageviewsJob.id);
      try {
        pageviewsSynced = await this.syncArticlePageviews(
          undefined,
          pageviewsSince,
          pageviewsJob.id,
          mode,
        );
      } catch (error) {
        await this.failSyncJob(pageviewsJob.id, error);
        await this.updateParentJobProgress(jobId, "Pageviews failed", childJobTypes);
        throw error;
      }
      if (await this.checkCancelled(pageviewsJob.id)) {
        await this.cancelSyncJob(pageviewsJob.id, { pageviewsSynced });
        await this.updateParentJobProgress(jobId, "Pageviews cancelled", childJobTypes);
        return {
          editorsSynced,
          articlesSynced,
          contributionsSynced,
          pageviewsSynced,
          commonsUploadsSynced,
        };
      }
      await this.completeSyncJob(pageviewsJob.id, { pageviewsSynced });
      await this.updateParentJobProgress(jobId, "Pageviews completed", childJobTypes);

      if (await this.checkCancelled(jobId)) {
        return {
          editorsSynced,
          articlesSynced,
          contributionsSynced,
          pageviewsSynced,
          commonsUploadsSynced,
        };
      }

      await this.updateParentJobProgress(jobId, "Syncing commons", childJobTypes);
      const commonsJob = await this.createSyncJob("commons", jobId);
      await this.startSyncJob(commonsJob.id);
      try {
        commonsUploadsSynced = await this.syncCommonsUploads(undefined, commonsJob.id);
      } catch (error) {
        await this.failSyncJob(commonsJob.id, error);
        await this.updateParentJobProgress(jobId, "Commons failed", childJobTypes);
        throw error;
      }
      if (await this.checkCancelled(commonsJob.id)) {
        await this.cancelSyncJob(commonsJob.id, { commonsUploadsSynced });
        await this.updateParentJobProgress(jobId, "Commons cancelled", childJobTypes);
        return {
          editorsSynced,
          articlesSynced,
          contributionsSynced,
          pageviewsSynced,
          commonsUploadsSynced,
        };
      }
      await this.completeSyncJob(commonsJob.id, { commonsUploadsSynced });
      await this.updateParentJobProgress(jobId, "Commons completed", childJobTypes);

      const summaryMetadata: Record<string, unknown> = {
        mode,
        editorsSynced,
        articlesSynced,
        contributionsSynced,
        pageviewsSynced,
        commonsUploadsSynced,
        totalExpected: childJobTypes.length,
        processed: childJobTypes.length,
        children: {
          editors: { synced: editorsSynced },
          outreach_articles: { synced: articlesSynced },
          contributions: { synced: contributionsSynced },
          pageviews: { synced: pageviewsSynced },
          commons: { synced: commonsUploadsSynced },
        },
      };

      if (windowStart) {
        summaryMetadata.windowStart = windowStart;
      }
      if (windowEnd) {
        summaryMetadata.windowEnd = windowEnd;
      }

      await this.completeSyncJob(jobId, summaryMetadata as Prisma.InputJsonObject);

      return {
        editorsSynced,
        articlesSynced,
        contributionsSynced,
        pageviewsSynced,
        commonsUploadsSynced,
      };
    } catch (error) {
      await this.failSyncJob(jobId, error);
      throw error;
    }
  }

  /**
   * Links contribution to existing Outreach article by title+wikiProject.
   * Returns null if article not in Outreach program (contribution will be skipped).
   */
  private async findArticleForContribution(
    contribution: UserContribution,
    wikiProject: string,
  ): Promise<{ id: string; createdByEditorId: string | null } | null> {
    const existingArticle = await this.prisma.article.findFirst({
      where: {
        title: contribution.title,
        wikiProject,
      },
    });

    if (!existingArticle) {
      return null;
    }

    if (!existingArticle.pageId || existingArticle.pageId !== contribution.pageId) {
      await this.prisma.article.update({
        where: { id: existingArticle.id },
        data: { pageId: contribution.pageId },
      });
    }

    return {
      id: existingArticle.id,
      createdByEditorId: existingArticle.createdByEditorId,
    };
  }

  private async storeCommonsUploads(editorId: string, uploads: CommonsUpload[]) {
    for (const upload of uploads) {
      await this.prisma.commonsUpload.upsert({
        where: { fileName: upload.fileName },
        create: {
          editorId,
          fileName: upload.fileName,
          fileUrl: upload.fileUrl,
          fileSize: upload.fileSize,
          mimeType: upload.mimeType,
          uploadedAt: new Date(upload.uploadedAt),
        },
        update: {
          fileUrl: upload.fileUrl,
          fileSize: upload.fileSize,
          mimeType: upload.mimeType,
          uploadedAt: new Date(upload.uploadedAt),
        },
      });
    }
  }

  private async getContributionWikiProjects() {
    const rows = await this.prisma.article.findMany({
      select: { wikiProject: true },
      distinct: ["wikiProject"],
      where: {
        wikiProject: {
          contains: ".wikipedia.org",
        },
      },
      orderBy: { wikiProject: "asc" },
    });

    return rows.map((row) => row.wikiProject);
  }
}
