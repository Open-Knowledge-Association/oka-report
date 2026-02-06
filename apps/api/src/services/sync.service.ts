import type { Prisma, PrismaClient } from "@repo/db/generated/prisma/client";
import type { CommonsUpload, UserContribution, WikimediaClient } from "@repo/utils";

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

export const FULL_SYNC_CHILD_JOB_TYPES = [
  "editors",
  "outreach_articles",
  "contributions",
  "pageviews",
  "commons",
] as const;

const bytesToWords = (bytesChanged: number) => Math.max(0, Math.floor(bytesChanged / 6));

const toPageviewsProject = (wikiProject: string) => wikiProject.replace(/\.org$/, "");

const formatDateForPageviews = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

const parsePageviewDate = (date: string) => new Date(`${date}T00:00:00Z`);

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

    await this.prisma.syncJob.update({
      where: { id: parentJobId },
      data: {
        metadata: {
          totalExpected: childJobTypes.length,
          processed,
          stage,
          children,
        },
      },
    });
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

    let syncedCount = 0;

    for (const editor of editors) {
      if (jobId && (await this.checkCancelled(jobId))) {
        return syncedCount;
      }

      const contributions = await this.wikimediaClient.getUserContributions(
        editor.username,
        since ? { start: since.toISOString() } : {},
      );

      for (const contribution of contributions) {
        const article = await this.findArticleForContribution(contribution);
        if (!article) {
          continue;
        }

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
            isCreation: contribution.parentId == null || contribution.parentId === 0,
            editTimestamp: new Date(contribution.timestamp),
          },
          update: {},
        });
        syncedCount += 1;
      }
    }

    return syncedCount;
  }

  async syncArticlePageviews(articleId?: string, since?: Date, jobId?: string) {
    const articles = await this.prisma.article.findMany({
      where: {
        ...(articleId ? { id: articleId } : {}),
        createdByEditorId: { not: null },
      },
    });

    let syncedCount = 0;

    for (const article of articles) {
      if (jobId && (await this.checkCancelled(jobId))) {
        return syncedCount;
      }

      const startDate = since ?? article.articleCreatedAt ?? new Date();
      const endDate = new Date();
      const pageviews = await this.wikimediaClient.getPageviews(
        article.title,
        toPageviewsProject(article.wikiProject),
        formatDateForPageviews(startDate),
        formatDateForPageviews(endDate),
      );

      for (const item of pageviews) {
        await this.prisma.pageview.upsert({
          where: {
            articleId_date: {
              articleId: article.id,
              date: parsePageviewDate(item.date),
            },
          },
          create: {
            articleId: article.id,
            date: parsePageviewDate(item.date),
            type: "DAILY",
            views: item.views,
          },
          update: {
            type: "DAILY",
            views: item.views,
          },
        });
        syncedCount += 1;
      }
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

    for (const editor of editors) {
      if (jobId && (await this.checkCancelled(jobId))) {
        return syncedCount;
      }

      const uploads = await this.wikimediaClient.getCommonsUploads(editor.username);
      await this.storeCommonsUploads(editor.id, uploads);
      syncedCount += uploads.length;
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
    return this.prisma.syncJob.update({
      where: { id: jobId },
      data: { status: "running", startedAt: new Date() },
    });
  }

  async completeSyncJob(jobId: string, metadata?: Prisma.InputJsonObject) {
    return this.prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        completedAt: new Date(),
        metadata,
      },
    });
  }

  async cancelSyncJob(jobId: string, metadata?: Prisma.InputJsonObject) {
    return this.prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: "cancelled",
        completedAt: new Date(),
        metadata,
      },
    });
  }

  async failSyncJob(jobId: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return this.prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        completedAt: new Date(),
        error: message,
      },
    });
  }

  async runFullSync(
    existingJobId?: string,
    preSyncStats?: PreSyncStats,
    childJobTypes: readonly string[] = FULL_SYNC_CHILD_JOB_TYPES,
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
          undefined,
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
        pageviewsSynced = await this.syncArticlePageviews(undefined, undefined, pageviewsJob.id);
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

      const summaryMetadata = {
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

      await this.completeSyncJob(jobId, summaryMetadata);

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
  ): Promise<{ id: string } | null> {
    const wikiProject = new URL(this.wikimediaClient.getBaseUrl()).host;

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

    return { id: existingArticle.id };
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
}
