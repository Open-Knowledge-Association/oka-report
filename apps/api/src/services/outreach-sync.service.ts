import type { PrismaClient } from "@repo/db/generated/prisma/client";
import { OutreachDashboardClient, type OutreachDashboardClientConfig } from "@repo/utils";

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
  async syncEditorsFromDashboard(school: string, slug: string): Promise<SyncResult> {
    // Create sync job
    const job = await this.prisma.syncJob.create({
      data: {
        jobType: "editors",
        status: "pending",
      },
    });

    try {
      // Mark job as running
      await this.prisma.syncJob.update({
        where: { id: job.id },
        data: {
          status: "running",
          startedAt: new Date(),
        },
      });

      // Fetch users from Outreach Dashboard
      const userData = await this.dashboardClient.getUsers(school, slug);
      const users = userData.course?.users ?? userData.users ?? [];

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

          // Track if this was a create or update
          // Since upsert doesn't tell us which, we check based on the create timestamp
          const createdJustNow = result.createdAt.getTime() > job.createdAt.getTime() - 1000;
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

      // Mark job as completed with metadata
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

  /**
   * Sync articles from Outreach Dashboard
   * Fetches article list and upserts into database
   *
   * @param school - Outreach Dashboard school code (e.g., "OKA")
   * @param slug - Outreach Dashboard course slug (e.g., "OKA")
   * @returns Sync result with import/update/error counts
   */
  async syncArticlesFromDashboard(school: string, slug: string): Promise<SyncResult> {
    try {
      const articleData = await this.dashboardClient.getArticles(school, slug);
      const articles = articleData.course?.articles ?? [];

      let imported = 0;
      let updated = 0;
      const errorDetails: Array<{ username: string; error: string }> = [];

      for (const article of articles) {
        try {
          const result = await this.prisma.outreachArticle.upsert({
            where: { outreachId: article.id || 0 },
            create: {
              outreachId: article.id || 0,
              title: article.title || "",
              language: article.language || "en",
              project: article.project || "wikipedia",
              url: article.url || "",
              characterSum: article.character_sum || 0,
              referencesCount: article.references_count || 0,
              isNewArticle: article.new_article || false,
              rating: article.rating || null,
            },
            update: {
              title: article.title || "",
              language: article.language || "en",
              project: article.project || "wikipedia",
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
    } catch (error) {
      throw error;
    }
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
