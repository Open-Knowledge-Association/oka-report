import type { PrismaClient } from "@repo/db/generated/prisma/client";
import type { OutreachDashboardClient } from "@repo/utils/src/outreach-dashboard/client";
import pLimit from "p-limit";

// Configuration constants for batch processing
const BATCH_SIZE = 100;
const CONCURRENCY = 5;
const CHECKPOINT_INTERVAL = 1000;

interface SyncProgress {
  totalExpected: number;
  processed: number;
  lastProcessedIndex: number;
  errors: number;
}

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

  async syncArticlesFromDashboard(school: string, slug: string): Promise<SyncResult> {
    // Check for running job to prevent concurrent syncs
    const runningJob = await this.prisma.syncJob.findFirst({
      where: {
        jobType: "outreach_articles",
        status: "running",
      },
    });
    if (runningJob) {
      throw new Error(`Sync already in progress (job ID: ${runningJob.id})`);
    }

    const job = await this.prisma.syncJob.create({
      data: {
        jobType: "outreach_articles",
        status: "pending",
      },
    });

    try {
      await this.prisma.syncJob.update({
        where: { id: job.id },
        data: {
          status: "running",
          startedAt: new Date(),
        },
      });

      const articleData = await this.dashboardClient.getArticles(school, slug);
      const articles = articleData.course.articles;

      const editors = await this.prisma.editor.findMany();
      const editorMap = new Map(editors.map((e) => [e.externalId, e]));

      let imported = 0;
      let updated = 0;
      const errorDetails: Array<{ articleId: number; error: string }> = [];
      let processedCount = 0;

      const batches = this.chunkArray(articles, BATCH_SIZE);
      const limit = pLimit(CONCURRENCY);

      for (const batch of batches) {
        const results = await Promise.allSettled(
          batch.map((article) =>
            limit(async () => {
              const outreachArticle = await this.prisma.outreachArticle.upsert({
                where: { outreachId: article.id },
                create: {
                  outreachId: article.id,
                  title: article.title,
                  language: article.language,
                  project: article.project,
                  url: article.url,
                  characterSum: article.character_sum,
                  referencesCount: article.references_count,
                  isNewArticle: article.new_article,
                  rating: article.rating,
                },
                update: {
                  title: article.title,
                  language: article.language,
                  project: article.project,
                  url: article.url,
                  characterSum: article.character_sum,
                  referencesCount: article.references_count,
                  isNewArticle: article.new_article,
                  rating: article.rating,
                  updatedAt: new Date(),
                },
              });

              const createdJustNow =
                outreachArticle.createdAt.getTime() > job.createdAt.getTime() - 1000;
              const isNewlyCreated = createdJustNow;

              const today = new Date();
              today.setUTCHours(0, 0, 0, 0);

              await this.prisma.outreachArticlePageview.upsert({
                where: {
                  outreachArticleId_snapshotDate: {
                    outreachArticleId: outreachArticle.id,
                    snapshotDate: today,
                  },
                },
                create: {
                  outreachArticleId: outreachArticle.id,
                  snapshotDate: today,
                  cumulativeViews: article.view_count,
                },
                update: {
                  cumulativeViews: article.view_count,
                },
              });

              for (const userId of article.user_ids) {
                const editor = editorMap.get(String(userId));

                if (editor) {
                  await this.prisma.outreachArticleEditor.upsert({
                    where: {
                      outreachArticleId_editorId: {
                        outreachArticleId: outreachArticle.id,
                        editorId: editor.id,
                      },
                    },
                    create: {
                      outreachArticleId: outreachArticle.id,
                      editorId: editor.id,
                    },
                    update: {},
                  });
                }
              }

              return { articleId: article.id, isNewlyCreated };
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
            const article = batch[i];
            const errorMessage =
              result.reason instanceof Error ? result.reason.message : String(result.reason);
            errorDetails.push({
              articleId: article.id,
              error: errorMessage,
            });
          }
        }

        if (processedCount % CHECKPOINT_INTERVAL === 0 || processedCount === articles.length) {
          await this.prisma.syncJob.update({
            where: { id: job.id },
            data: {
              metadata: {
                totalExpected: articles.length,
                processed: processedCount,
                lastProcessedIndex: processedCount,
                errors: errorDetails.length,
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

      await this.prisma.syncJob.update({
        where: { id: job.id },
        data: {
          status: "completed",
          completedAt: new Date(),
          metadata: result as any,
        },
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.prisma.syncJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          completedAt: new Date(),
          error: errorMessage,
        },
      });
      throw error;
    }
  }
}
