import type { Prisma, PrismaClient } from "@repo/db/generated/prisma/client";
import type { CommonsUpload, UserContribution, WikimediaClient } from "@repo/utils";

type SyncSummary = {
  contributionsSynced: number;
  pageviewsSynced: number;
  commonsUploadsSynced: number;
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
      // Check cancellation before processing each editor
      if (jobId && (await this.checkCancelled(jobId))) {
        return syncedCount;
      }

      const contributions = await this.wikimediaClient.getUserContributions(
        editor.username,
        since ? { start: since.toISOString() } : {},
      );

      for (const contribution of contributions) {
        const article = await this.upsertArticle(contribution, editor.id);
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

  async runFullSync(): Promise<SyncSummary> {
    const job = await this.createSyncJob("full");
    await this.startSyncJob(job.id);

    try {
      const contributionsSynced = await this.syncEditorContributions(undefined, undefined, job.id);

      if (await this.checkCancelled(job.id)) {
        return { contributionsSynced, pageviewsSynced: 0, commonsUploadsSynced: 0 };
      }

      const pageviewsSynced = await this.syncArticlePageviews(undefined, undefined, job.id);

      if (await this.checkCancelled(job.id)) {
        return { contributionsSynced, pageviewsSynced, commonsUploadsSynced: 0 };
      }

      const commonsUploadsSynced = await this.syncCommonsUploads(undefined, job.id);

      if (await this.checkCancelled(job.id)) {
        return { contributionsSynced, pageviewsSynced, commonsUploadsSynced };
      }

      await this.completeSyncJob(job.id, {
        contributionsSynced,
        pageviewsSynced,
        commonsUploadsSynced,
      });

      return {
        contributionsSynced,
        pageviewsSynced,
        commonsUploadsSynced,
      };
    } catch (error) {
      await this.failSyncJob(job.id, error);
      throw error;
    }
  }

  private async upsertArticle(contribution: UserContribution, editorId: string) {
    const wikiProject = new URL(this.wikimediaClient.getBaseUrl()).host;
    const isCreation = contribution.parentId == null || contribution.parentId === 0;
    const articleInfo = isCreation
      ? await this.wikimediaClient.getArticleInfo(contribution.title)
      : null;

    return this.prisma.article.upsert({
      where: {
        pageId_wikiProject: {
          pageId: contribution.pageId,
          wikiProject,
        },
      },
      create: {
        pageId: contribution.pageId,
        title: contribution.title,
        wikiProject,
        source: "MEDIAWIKI",
        createdByEditorId: articleInfo?.creator === contribution.username ? editorId : null,
        articleCreatedAt: articleInfo?.createdAt ? new Date(articleInfo.createdAt) : null,
      },
      update: {
        title: contribution.title,
        source: "MEDIAWIKI",
        createdByEditorId: articleInfo?.creator === contribution.username ? editorId : undefined,
        articleCreatedAt: articleInfo?.createdAt ? new Date(articleInfo.createdAt) : undefined,
      },
    });
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
