import type { PrismaClient } from "@repo/db/generated/prisma/client";
import {
  OutreachDashboardClient,
  type OutreachDashboardClientConfig,
  normalizeWikiProject,
} from "@repo/utils";

interface SyncResult {
  imported: number;
  updated: number;
  errors: number;
  errorDetails: Array<{ username: string; error: string }>;
}

export class OutreachSyncService {
  private readonly prisma: PrismaClient;
  private readonly dashboardClient: OutreachDashboardClient;

  constructor(prisma: PrismaClient, dashboardConfig: OutreachDashboardClientConfig) {
    this.prisma = prisma;
    this.dashboardClient = new OutreachDashboardClient(dashboardConfig);
  }

  /**
   * Sync editors from Outreach Dashboard
   * Fetches user list, normalizes usernames, and upserts editors
   *
   * @param school - Outreach Dashboard school code (e.g., "OKA")
   * @param slug - Outreach Dashboard course slug (e.g., "OKA")
   * @returns Sync result with import/update/error counts
   */
  async syncEditorsFromDashboard(
    school: string,
    slug: string,
    options?: { parentJobId?: string; jobId?: string },
  ): Promise<SyncResult> {
    const parentJobId = options?.parentJobId;
    const jobIdOverride = options?.jobId;
    const startTime = Date.now();

    let jobId: string | null = null;
    if (jobIdOverride) {
      jobId = jobIdOverride;
    } else {
      const job = await this.prisma.syncJob.create({
        data: {
          jobType: "editors",
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
      const userData = await this.dashboardClient.getUsers(school, slug);
      const allUsers = userData.course?.users ?? userData.users ?? [];
      const users = allUsers.filter((user) => user.role === 0);

      let imported = 0;
      let updated = 0;
      const errorDetails: Array<{ username: string; error: string }> = [];

      // Process each user
      for (const user of users) {
        try {
          // Normalize username: replace spaces with underscores
          const normalizedUsername = this.normalizeUsername(user.username);

          // Upsert editor using username as unique key
          const result = await this.prisma.editor.upsert({
            where: { username: normalizedUsername },
            create: {
              username: normalizedUsername,
              externalId: String(user.id),
              source: "outreach_dashboard",
              isActive: true,
            },
            update: {
              externalId: String(user.id),
              source: "outreach_dashboard",
              isActive: true,
              updatedAt: new Date(),
            },
          });

          const createdJustNow = result.createdAt.getTime() > startTime - 1000;
          if (createdJustNow) {
            imported++;
          } else {
            updated++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errorDetails.push({
            username: user.username,
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

      if (jobId) {
        await this.prisma.syncJob.update({
          where: { id: jobId },
          data: {
            status: "completed",
            completedAt: new Date(),
            metadata: result as any,
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

  /**
   * Sync articles from Outreach Dashboard
   * Fetches article list and upserts into database
   *
   * @param school - Outreach Dashboard school code (e.g., "OKA")
   * @param slug - Outreach Dashboard course slug (e.g., "OKA")
   * @returns Sync result with import/update/error counts
   */
  async syncArticlesFromDashboard(school: string, slug: string): Promise<SyncResult> {
    const articleData = await this.dashboardClient.getArticles(school, slug);
    const articles = articleData.course?.articles ?? [];

    let imported = 0;
    let updated = 0;
    const errorDetails: Array<{ username: string; error: string }> = [];

    for (const article of articles) {
      try {
        const result = await this.prisma.article.upsert({
          where: { outreachId: article.id || 0 },
          create: {
            pageId: null,
            title: article.title || "",
            wikiProject: normalizeWikiProject(
              article.language || "en",
              article.project || "wikipedia",
            ),
            source: "OUTREACH_DASHBOARD",
            outreachId: article.id || 0,
            url: article.url || "",
            characterSum: article.character_sum || 0,
            referencesCount: article.references_count || 0,
            isNewArticle: article.new_article || false,
            rating: article.rating || null,
          },
          update: {
            title: article.title || "",
            wikiProject: normalizeWikiProject(
              article.language || "en",
              article.project || "wikipedia",
            ),
            source: "OUTREACH_DASHBOARD",
            url: article.url || "",
            characterSum: article.character_sum || 0,
            referencesCount: article.references_count || 0,
            isNewArticle: article.new_article || false,
            rating: article.rating || null,
            updatedAt: new Date(),
          },
        });

        const createdJustNow = result.createdAt.getTime() > Date.now() - 5000;
        if (createdJustNow) {
          imported++;
        } else {
          updated++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errorDetails.push({
          username: article.title || "Unknown",
          error: errorMessage,
        });
      }
    }

    const syncResult: SyncResult = {
      imported,
      updated,
      errors: errorDetails.length,
      errorDetails,
    };

    return syncResult;
  }

  /**
   * Normalize Wikipedia username: replace spaces with underscores
   * @param username - Raw username from Outreach Dashboard
   * @returns Normalized username for Wikipedia
   */
  private normalizeUsername(username: string): string {
    return username.replace(/\s+/g, "_");
  }
}
