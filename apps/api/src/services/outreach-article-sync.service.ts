import type { PrismaClient } from "@repo/db/generated/prisma/client";
import type { OutreachDashboardClient } from "@repo/utils/src/outreach-dashboard/client";

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

  async syncArticlesFromDashboard(school: string, slug: string): Promise<SyncResult> {
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

      let imported = 0;
      let updated = 0;
      const errorDetails: Array<{ articleId: number; error: string }> = [];

      for (const article of articles) {
        try {
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
          if (createdJustNow) {
            imported++;
          } else {
            updated++;
          }

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
            const editor = await this.prisma.editor.findUnique({
              where: { externalId: String(userId) },
            });

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
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errorDetails.push({
            articleId: article.id,
            error: errorMessage,
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
