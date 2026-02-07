import type { PrismaClient } from "@repo/db/generated/prisma/client";
import type { OutreachDashboardClient } from "@repo/utils/src/outreach-dashboard/client";
import { normalizeWikiProject, WikimediaClient } from "@repo/utils";
import pLimit from "p-limit";

// Configuration constants for batch processing
const BATCH_SIZE = 100;
const CONCURRENCY = 5;
const CHECKPOINT_INTERVAL = 1000;

interface SyncResult {
  imported: number;
  updated: number;
  errors: number;
  errorDetails: Array<{ articleId: number; error: string }>;
}

export class OutreachArticleSyncService {
  private readonly prisma: PrismaClient;
  private readonly dashboardClient: OutreachDashboardClient;

  constructor(prisma: PrismaClient, dashboardClient: OutreachDashboardClient) {
    this.prisma = prisma;
    this.dashboardClient = dashboardClient;
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

      const batches = this.chunkArray(articles, BATCH_SIZE);
      const limit = pLimit(CONCURRENCY);

      for (const batch of batches) {
        if (jobId) {
          const currentJob = await this.prisma.syncJob.findUnique({
            where: { id: jobId },
          });
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
              const existingArticle = await this.prisma.article.findFirst({
                where: {
                  title: dashboardArticle.title,
                  wikiProject,
                },
              });

              const article = existingArticle
                ? await this.prisma.article.update({
                    where: { id: existingArticle.id },
                    data: {
                      outreachId: existingArticle.outreachId ?? dashboardArticle.id,
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
                  })
                : await this.prisma.article.upsert({
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
                  articleId_date: {
                    articleId: article.id,
                    date: today,
                  },
                },
                create: {
                  articleId: article.id,
                  date: today,
                  type: "CUMULATIVE",
                  views: dashboardArticle.view_count,
                  cumulativeViews: dashboardArticle.view_count,
                },
                update: {
                  type: "CUMULATIVE",
                  views: dashboardArticle.view_count,
                  cumulativeViews: dashboardArticle.view_count,
                },
              });

              for (const userId of dashboardArticle.user_ids) {
                const editor = editorMap.get(String(userId));

                if (editor) {
                  const articleEditor = await this.prisma.articleEditor.upsert({
                    where: {
                      articleId_editorId: {
                        articleId: article.id,
                        editorId: editor.id,
                      },
                    },
                    create: {
                      articleId: article.id,
                      editorId: editor.id,
                    },
                    update: {},
                  });

                  // Detect if this editor is the article creator
                  try {
                    const wikiBaseUrl = `https://${dashboardArticle.language}.${dashboardArticle.project}.org`;
                    const wikimediaClient = new WikimediaClient({ baseUrl: wikiBaseUrl });
                    const articleInfo = await wikimediaClient.getArticleInfo(
                      dashboardArticle.title,
                    );

                    if (articleInfo?.creator) {
                      // Normalize usernames: replace spaces with underscores for comparison
                      const normalizedCreator = articleInfo.creator.replace(/\s+/g, "_");
                      const normalizedEditor = editor.username.replace(/\s+/g, "_");

                      if (normalizedCreator === normalizedEditor) {
                        await this.prisma.articleEditor.update({
                          where: { id: articleEditor.id },
                          data: { isAuthor: true },
                        });

                        // Also set createdByEditorId on the article for consistency
                        if (!article.createdByEditorId) {
                          await this.prisma.article.update({
                            where: { id: article.id },
                            data: { createdByEditorId: editor.id },
                          });
                        }
                      }
                    }
                  } catch (error) {
                    // Gracefully handle author detection failures - don't block sync
                    console.warn(
                      `Failed to detect author for article "${dashboardArticle.title}" and editor "${editor.username}":`,
                      error instanceof Error ? error.message : String(error),
                    );
                  }
                }
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
          await this.prisma.syncJob.update({
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
          });
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
