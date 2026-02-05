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

  /**
   * Check if a job has been cancelled and update its status if so.
   * Returns true if cancelled (caller should stop processing).
   */
  private async checkCancelled(jobId: string): Promise<boolean> {
    const job = await this.prisma.syncJob.findUnique({
      where: { id: jobId },
    });
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

  async createSyncJob(jobType: string) {
    return this.prisma.syncJob.create({
      data: {
        jobType,
        status: "pending",
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

  async runFullSync(existingJobId?: string, preSyncStats?: PreSyncStats): Promise<SyncSummary> {
    const jobId = existingJobId ?? (await this.createSyncJob("full")).id;
    if (!existingJobId) {
      await this.startSyncJob(jobId);
    }

    const editorsSynced = preSyncStats?.editorsSynced;
    const articlesSynced = preSyncStats?.articlesSynced;

    try {
      const contributionsSynced = await this.syncEditorContributions(undefined, undefined, jobId);

      if (await this.checkCancelled(jobId)) {
        return {
          editorsSynced,
          articlesSynced,
          contributionsSynced,
          pageviewsSynced: 0,
          commonsUploadsSynced: 0,
        };
      }

      const pageviewsSynced = await this.syncArticlePageviews(undefined, undefined, jobId);

      if (await this.checkCancelled(jobId)) {
        return {
          editorsSynced,
          articlesSynced,
          contributionsSynced,
          pageviewsSynced,
          commonsUploadsSynced: 0,
        };
      }

      const commonsUploadsSynced = await this.syncCommonsUploads(undefined, jobId);

      if (await this.checkCancelled(jobId)) {
        return {
          editorsSynced,
          articlesSynced,
          contributionsSynced,
          pageviewsSynced,
          commonsUploadsSynced,
        };
      }

      await this.completeSyncJob(jobId, {
        editorsSynced,
        articlesSynced,
        contributionsSynced,
        pageviewsSynced,
        commonsUploadsSynced,
      });

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

    if (existingArticle.pageId === 0 || existingArticle.pageId !== contribution.pageId) {
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
