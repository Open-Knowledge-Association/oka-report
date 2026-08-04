import type { PrismaClient } from "@repo/db/generated/prisma/client";
import type { OutreachDashboardClient } from "@repo/utils/src/outreach-dashboard/client";
import { normalizeWikiProject, WikimediaClient } from "@repo/utils";
import pLimit from "p-limit";

// Configuration constants for batch processing
const BATCH_SIZE = 100;
const CONCURRENCY = 10;
const CHECKPOINT_INTERVAL = 1000;

const normalizeAuthorUsername = (value: string) =>
  value.normalize("NFC").replace(/\s+/g, "_").toLowerCase();

interface SyncResult {
  imported: number;
  updated: number;
  errors: number;
  errorDetails: Array<{ articleId: number; error: string }>;
}

export class OutreachArticleSyncService {
  private readonly prisma: PrismaClient;
  private readonly dashboardClient: OutreachDashboardClient;
  private readonly wikimediaClientFactory: (
    baseUrl: string,
  ) => Pick<WikimediaClient, "getArticleInfo">;

  constructor(
    prisma: PrismaClient,
    dashboardClient: OutreachDashboardClient,
    wikimediaClientFactory: (baseUrl: string) => Pick<WikimediaClient, "getArticleInfo"> = (
      baseUrl,
    ) => new WikimediaClient({ baseUrl }),
  ) {
    this.prisma = prisma;
    this.dashboardClient = dashboardClient;
    this.wikimediaClientFactory = wikimediaClientFactory;
  }

  private async withDbRetry<T>(operation: () => Promise<T>, label: string): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < 3) {
          console.warn(`[OutreachSync] ${label} failed (attempt ${attempt}/3), retrying`);
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        }
      }
    }
    throw lastError;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
      array.slice(i * size, i * size + size),
    );
  }

  async syncArticlesFromDashboard(
    school: string,
    slug: string,
    options?: { parentJobId?: string; jobId?: string },
  ): Promise<SyncResult> {
    const parentJobId = options?.parentJobId;
    const jobIdOverride = options?.jobId;
    const startTime = Date.now();

    let jobId: string | null = null;

    if (!parentJobId && !jobIdOverride) {
      const runningJob = await this.prisma.syncJob.findFirst({
        where: {
          jobType: "outreach_articles",
          status: { in: ["running", "pending"] },
        },
      });
      if (runningJob) {
        throw new Error(`Sync already in progress (job ID: ${runningJob.id})`);
      }
    }
    if (jobIdOverride) {
      jobId = jobIdOverride;
    } else {
      const job = await this.prisma.syncJob.create({
        data: {
          jobType: "outreach_articles",
          status: "pending",
          parentJobId,
        },
      });
      jobId = job.id;
    }

    await this.prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: "running",
        startedAt: new Date(),
      },
    });

    try {
      const articleData = await this.dashboardClient.getArticles(school, slug);
      const articles = articleData.course.articles;

      const editors = await this.prisma.editor.findMany();
      const editorMap = new Map(editors.map((e) => [e.externalId, e]));

      let imported = 0;
      let updated = 0;
      const errorDetails: Array<{ articleId: number; error: string }> = [];
      const errorSamples: Array<{ articleId: number; error: string }> = [];
      const MAX_ERROR_SAMPLES = 50;
      let processedCount = 0;

      // Checkpoint is persisted in SyncJob.metadata. On recovery, replay only
      // the last uncommitted checkpoint window; all writes are idempotent.
      const checkpointJob = jobId
        ? await this.prisma.syncJob.findUnique({ where: { id: jobId }, select: { metadata: true } })
        : null;
      const checkpointMetadata = checkpointJob?.metadata;
      const checkpointProcessed =
        checkpointMetadata &&
        typeof checkpointMetadata === "object" &&
        !Array.isArray(checkpointMetadata)
          ? Number((checkpointMetadata as { processed?: unknown }).processed ?? 0)
          : 0;
      const resumeFrom = Number.isFinite(checkpointProcessed)
        ? Math.min(
            articles.length,
            Math.max(
              0,
              Math.floor(checkpointProcessed / CHECKPOINT_INTERVAL) * CHECKPOINT_INTERVAL,
            ),
          )
        : 0;

      const batches = this.chunkArray(articles.slice(resumeFrom), BATCH_SIZE);
      const limit = pLimit(CONCURRENCY);
      processedCount = resumeFrom;

      if (jobId && resumeFrom > 0) {
        await this.prisma.syncJob.update({
          where: { id: jobId },
          data: {
            metadata: {
              total: articles.length,
              processed: resumeFrom,
              stage: `Resuming articles from checkpoint (${resumeFrom}/${articles.length})`,
              resumed: true,
              imported,
              updated,
              errors: 0,
            } as any,
          },
        });
      }

      for (const batch of batches) {
        if (jobId) {
          const currentJob = await this.withDbRetry(
            () => this.prisma.syncJob.findUnique({ where: { id: jobId } }),
            "sync job state lookup",
          );
          if (currentJob?.status === "cancelled") {
            await this.prisma.syncJob.update({
              where: { id: jobId },
              data: {
                status: "cancelled",
                completedAt: new Date(),
                metadata: {
                  total: articles.length,
                  processed: processedCount,
                  stage: "Cancelled by user",
                  imported,
                  updated,
                  errors: errorDetails.length,
                } as any,
              },
            });
            return {
              imported,
              updated,
              errors: errorDetails.length,
              errorDetails,
            };
          }
        }

        const results = await Promise.allSettled(
          batch.map((dashboardArticle) =>
            limit(async () => {
              const wikiProject = normalizeWikiProject(
                dashboardArticle.language,
                dashboardArticle.project,
              );
              // Outreach Dashboard ID is the source-of-truth identity. Do not
              // merge records by title: the same title can legitimately appear
              // in multiple courses/projects or represent different source rows.
              const article = await this.prisma.article.upsert({
                where: { outreachId: dashboardArticle.id },
                create: {
                  outreachId: dashboardArticle.id,
                  pageId: null,
                  title: dashboardArticle.title,
                  wikiProject,
                  source: "OUTREACH_DASHBOARD",
                  url: dashboardArticle.url,
                  characterSum: dashboardArticle.character_sum,
                  referencesCount: dashboardArticle.references_count,
                  isNewArticle: dashboardArticle.new_article,
                  rating: dashboardArticle.rating,
                  authorStatus: "unknown",
                },
                update: {
                  title: dashboardArticle.title,
                  wikiProject,
                  source: "OUTREACH_DASHBOARD",
                  url: dashboardArticle.url,
                  characterSum: dashboardArticle.character_sum,
                  referencesCount: dashboardArticle.references_count,
                  isNewArticle: dashboardArticle.new_article,
                  rating: dashboardArticle.rating,
                  updatedAt: new Date(),
                },
              });

              const createdJustNow = article.createdAt.getTime() > startTime - 1000;
              const isNewlyCreated = createdJustNow;

              const today = new Date();
              today.setUTCHours(0, 0, 0, 0);

              await this.prisma.pageview.upsert({
                where: {
                  articleId_date_type_agentType: {
                    articleId: article.id,
                    date: today,
                    type: "CUMULATIVE",
                    agentType: "ALL_AGENTS",
                  },
                },
                create: {
                  articleId: article.id,
                  date: today,
                  type: "CUMULATIVE",
                  agentType: "ALL_AGENTS",
                  views: dashboardArticle.view_count,
                  cumulativeViews: dashboardArticle.view_count,
                },
                update: {
                  views: dashboardArticle.view_count,
                  cumulativeViews: dashboardArticle.view_count,
                },
              });

              // Resolve the creator once per article. The previous implementation
              // queried Wikimedia once per editor, multiplying external requests.
              let creatorUsername: string | null = null;
              let authorStatus:
                | "unknown"
                | "verified_tracked"
                | "verified_external"
                | "unavailable" = "unknown";
              if (dashboardArticle.user_ids.length > 0) {
                try {
                  const wikiBaseUrl = `https://${dashboardArticle.language}.${dashboardArticle.project}.org`;
                  const wikimediaClient = this.wikimediaClientFactory(wikiBaseUrl);
                  const articleInfo = await wikimediaClient.getArticleInfo(dashboardArticle.title);
                  creatorUsername = articleInfo?.creator ?? null;
                  authorStatus = creatorUsername ? "verified_external" : "unavailable";
                } catch (error) {
                  authorStatus = "unknown";
                  console.warn(
                    `Failed to detect author for article "${dashboardArticle.title}":`,
                    error instanceof Error ? error.message : String(error),
                  );
                }
              }

              const authorEditor = creatorUsername
                ? (editors.find(
                    (editor) =>
                      normalizeAuthorUsername(editor.username) ===
                      normalizeAuthorUsername(creatorUsername!),
                  ) ?? null)
                : null;
              if (authorEditor) authorStatus = "verified_tracked";
              await this.prisma.article.update({
                where: { id: article.id },
                data: {
                  authorStatus,
                  authorUsername: creatorUsername,
                  authorVerifiedAt: authorStatus === "unknown" ? null : new Date(),
                  createdByEditorId: authorEditor?.id ?? null,
                },
              });

              for (const userId of dashboardArticle.user_ids) {
                const editor = editorMap.get(String(userId));
                if (!editor) continue;

                await this.prisma.articleEditor.upsert({
                  where: {
                    articleId_editorId: {
                      articleId: article.id,
                      editorId: editor.id,
                    },
                  },
                  create: {
                    articleId: article.id,
                    editorId: editor.id,
                    isAuthor: Boolean(authorEditor && authorEditor.id === editor.id),
                  },
                  update: {
                    isAuthor: Boolean(authorEditor && authorEditor.id === editor.id),
                  },
                });
              }

              return { articleId: dashboardArticle.id, isNewlyCreated };
            }),
          ),
        );

        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          processedCount++;

          if (result.status === "fulfilled") {
            if (result.value.isNewlyCreated) {
              imported++;
            } else {
              updated++;
            }
          } else {
            const dashboardArticle = batch[i];
            const errorMessage =
              result.reason instanceof Error ? result.reason.message : String(result.reason);
            const sample = { articleId: dashboardArticle.id, error: errorMessage };
            errorDetails.push(sample);
            if (errorSamples.length < MAX_ERROR_SAMPLES) {
              errorSamples.push(sample);
            }
          }
        }

        if (
          jobId &&
          (processedCount % CHECKPOINT_INTERVAL === 0 || processedCount === articles.length)
        ) {
          await this.withDbRetry(
            () =>
              this.prisma.syncJob.update({
                where: { id: jobId },
                data: {
                  metadata: {
                    total: articles.length,
                    processed: processedCount,
                    stage: `Processing articles (${processedCount}/${articles.length})`,
                    imported,
                    updated,
                    errors: errorDetails.length,
                    errorsSample: errorSamples,
                  } as any,
                },
              }),
            "article sync checkpoint",
          );
        }
      }

      const result: SyncResult = {
        imported,
        updated,
        errors: errorDetails.length,
        errorDetails,
      };

      if (jobId) {
        await this.prisma.syncJob.update({
          where: { id: jobId },
          data: {
            status: "completed",
            completedAt: new Date(),
            metadata: {
              ...result,
              errorsSample: errorSamples,
            } as any,
          },
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (jobId) {
        await this.prisma.syncJob.update({
          where: { id: jobId },
          data: {
            status: "failed",
            completedAt: new Date(),
            error: errorMessage,
          },
        });
      }
      throw error;
    }
  }
}
