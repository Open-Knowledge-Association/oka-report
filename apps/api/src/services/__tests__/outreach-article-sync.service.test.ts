import { describe, it, expect, beforeEach, mock } from "bun:test";
import { OutreachArticleSyncService } from "../outreach-article-sync.service";
import { normalizeWikiProject } from "@repo/utils";
import type { PrismaClient } from "@repo/db/generated/prisma/client";
import type { OutreachDashboardClient } from "@repo/utils/src/outreach-dashboard/client";
import type { ArticleData, OutreachArticle } from "@repo/utils/src/outreach-dashboard/types";

describe("OutreachArticleSyncService", () => {
  let service: OutreachArticleSyncService;
  let mockPrisma: PrismaClient;
  let mockDashboardClient: OutreachDashboardClient;
  let jobCreatedAt: Date;

  beforeEach(() => {
    jobCreatedAt = new Date();

    mockPrisma = {
      syncJob: {
        create: mock(() => Promise.resolve({ id: "job-123", createdAt: jobCreatedAt })),
        update: mock(() => Promise.resolve({ id: "job-123" })),
        findFirst: mock(() => Promise.resolve(null)),
        findUnique: mock(() => Promise.resolve({ id: "job-123", status: "running" })),
      },
      article: {
        findFirst: mock(() => Promise.resolve(null)),
        upsert: mock(() =>
          Promise.resolve({
            id: "article-1",
            outreachId: 100,
            createdAt: new Date(jobCreatedAt.getTime() + 500),
          }),
        ),
        update: mock(() =>
          Promise.resolve({
            id: "article-1",
            outreachId: 100,
            createdAt: new Date(jobCreatedAt.getTime() + 500),
          }),
        ),
      },
      pageview: {
        upsert: mock(() => Promise.resolve({ id: "pageview-1" })),
      },
      articleEditor: {
        upsert: mock(() =>
          Promise.resolve({
            id: "article-editor-1",
            articleId: "article-1",
            editorId: "editor-1",
          }),
        ),
        update: mock(() => Promise.resolve({ id: "article-editor-1" })),
      },
      editor: {
        findMany: mock(() => Promise.resolve([])),
        findUnique: mock(() => Promise.resolve(null)),
      },
    } as unknown as PrismaClient;

    mockDashboardClient = {
      getArticles: mock(() =>
        Promise.resolve({
          course: {
            articles: [],
          },
        } as ArticleData),
      ),
    } as unknown as OutreachDashboardClient;

    service = new OutreachArticleSyncService(mockPrisma, mockDashboardClient, () => ({ getArticleInfo: mock(() => Promise.resolve(null)) }));
  });

  describe("syncArticlesFromDashboard", () => {
    it("should create sync job with pending status", async () => {
      mockDashboardClient.getArticles = mock(() =>
        Promise.resolve({
          course: { articles: [] },
        } as ArticleData),
      );

      await service.syncArticlesFromDashboard("OKA", "oka");

      expect(mockPrisma.syncJob.create).toHaveBeenCalledWith({
        data: {
          jobType: "outreach_articles",
          status: "pending",
        },
      });
    });

    it("should update sync job to running status", async () => {
      mockDashboardClient.getArticles = mock(() =>
        Promise.resolve({
          course: { articles: [] },
        } as ArticleData),
      );

      await service.syncArticlesFromDashboard("OKA", "oka");

      expect(mockPrisma.syncJob.update).toHaveBeenCalledWith({
        where: { id: "job-123" },
        data: {
          status: "running",
          startedAt: expect.any(Date),
        },
      });
    });

    it("should upsert articles by outreachId", async () => {
      const wikiProject = normalizeWikiProject("en", "wikipedia");
      const mockArticles: OutreachArticle[] = [
        {
          id: 100,
          title: "Test_Article",
          language: "en",
          project: "wikipedia",
          view_count: 1000,
          average_views: 50,
          character_sum: 5000,
          references_count: 10,
          new_article: true,
          rating: "B",
          url: "https://en.wikipedia.org/wiki/Test_Article",
          user_ids: [],
        },
      ];

      mockDashboardClient.getArticles = mock(() =>
        Promise.resolve({
          course: { articles: mockArticles },
        } as ArticleData),
      );

      await service.syncArticlesFromDashboard("OKA", "oka");

      expect(mockPrisma.article.upsert).toHaveBeenCalledWith({
        where: { outreachId: 100 },
        create: {
          outreachId: 100,
          pageId: null,
          title: "Test_Article",
          wikiProject,
          source: "OUTREACH_DASHBOARD",
          url: "https://en.wikipedia.org/wiki/Test_Article",
          characterSum: 5000,
          referencesCount: 10,
          isNewArticle: true,
          rating: "B",
          authorStatus: "unknown",
        },
        update: {
          title: "Test_Article",
          wikiProject,
          source: "OUTREACH_DASHBOARD",
          url: "https://en.wikipedia.org/wiki/Test_Article",
          characterSum: 5000,
          referencesCount: 10,
          isNewArticle: true,
          rating: "B",
          updatedAt: expect.any(Date),
        },
      });
    });

    it("should merge existing article by title and wikiProject", async () => {
      const wikiProject = normalizeWikiProject("en", "wikipedia");
      const mockArticles: OutreachArticle[] = [
        {
          id: 100,
          title: "Test_Article",
          language: "en",
          project: "wikipedia",
          view_count: 1000,
          average_views: 50,
          character_sum: 5000,
          references_count: 10,
          new_article: true,
          rating: "B",
          url: "https://en.wikipedia.org/wiki/Test_Article",
          user_ids: [],
        },
      ];

      mockDashboardClient.getArticles = mock(() =>
        Promise.resolve({
          course: { articles: mockArticles },
        } as ArticleData),
      );

      mockPrisma.article.findFirst = mock(() =>
        Promise.resolve({
          id: "article-existing",
          outreachId: null,
          createdAt: new Date(jobCreatedAt.getTime() - 5000),
        }),
      ) as unknown as PrismaClient["article"]["findFirst"];

      await service.syncArticlesFromDashboard("OKA", "oka");

      expect(mockPrisma.article.upsert).toHaveBeenCalled();
      const call = (mockPrisma.article.upsert as any).mock.calls[0][0];
      expect(call.where).toEqual({ outreachId: 100 });
      expect(mockPrisma.article.update).toHaveBeenCalled();
    });

    it("should create pageview snapshot with current date", async () => {
      const mockArticles: OutreachArticle[] = [
        {
          id: 100,
          title: "Test_Article",
          language: "en",
          project: "wikipedia",
          view_count: 1000,
          average_views: 50,
          character_sum: 5000,
          references_count: 10,
          new_article: true,
          rating: "B",
          url: "https://en.wikipedia.org/wiki/Test_Article",
          user_ids: [],
        },
      ];

      mockDashboardClient.getArticles = mock(() =>
        Promise.resolve({
          course: { articles: mockArticles },
        } as ArticleData),
      );

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      await service.syncArticlesFromDashboard("OKA", "oka");

      expect(mockPrisma.pageview.upsert).toHaveBeenCalledWith({
        where: {
          articleId_date_type_agentType: {
            articleId: "article-1",
            date: today,
            type: "CUMULATIVE",
            agentType: "ALL_AGENTS",
          },
        },
        create: {
          articleId: "article-1",
          date: today,
          type: "CUMULATIVE",
          agentType: "ALL_AGENTS",
          views: 1000,
          cumulativeViews: 1000,
        },
        update: {
          views: 1000,
          cumulativeViews: 1000,
        },
      });
    });

    it("should link editors via user_ids when editor exists", async () => {
      const mockArticles: OutreachArticle[] = [
        {
          id: 100,
          title: "Test_Article",
          language: "en",
          project: "wikipedia",
          view_count: 1000,
          average_views: 50,
          character_sum: 5000,
          references_count: 10,
          new_article: true,
          rating: "B",
          url: "https://en.wikipedia.org/wiki/Test_Article",
          user_ids: [42, 99],
        },
      ];

      mockDashboardClient.getArticles = mock(() =>
        Promise.resolve({
          course: { articles: mockArticles },
        } as ArticleData),
      );

      mockPrisma.editor.findMany = mock(() =>
        Promise.resolve([{ id: "editor-42", externalId: "42" }]),
      ) as unknown as PrismaClient["editor"]["findMany"];

      await service.syncArticlesFromDashboard("OKA", "oka");

      expect(mockPrisma.editor.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.articleEditor.upsert).toHaveBeenCalledTimes(1);
      expect(mockPrisma.articleEditor.upsert).toHaveBeenCalledWith({
        where: {
          articleId_editorId: {
            articleId: "article-1",
            editorId: "editor-42",
          },
        },
        create: {
          articleId: "article-1",
          editorId: "editor-42",
          isAuthor: false,
        },
        update: { isAuthor: false },
      });
    });

    it("should skip editor linking when editor not found", async () => {
      const mockArticles: OutreachArticle[] = [
        {
          id: 100,
          title: "Test_Article",
          language: "en",
          project: "wikipedia",
          view_count: 1000,
          average_views: 50,
          character_sum: 5000,
          references_count: 10,
          new_article: true,
          rating: "B",
          url: "https://en.wikipedia.org/wiki/Test_Article",
          user_ids: [999],
        },
      ];

      mockDashboardClient.getArticles = mock(() =>
        Promise.resolve({
          course: { articles: mockArticles },
        } as ArticleData),
      );

      await service.syncArticlesFromDashboard("OKA", "oka");

      expect(mockPrisma.articleEditor.upsert).not.toHaveBeenCalled();
    });

    it("should complete sync job with metadata", async () => {
      const mockArticles: OutreachArticle[] = [
        {
          id: 100,
          title: "Test_Article_1",
          language: "en",
          project: "wikipedia",
          view_count: 1000,
          average_views: 50,
          character_sum: 5000,
          references_count: 10,
          new_article: true,
          rating: "B",
          url: "https://en.wikipedia.org/wiki/Test_Article_1",
          user_ids: [],
        },
        {
          id: 101,
          title: "Test_Article_2",
          language: "en",
          project: "wikipedia",
          view_count: 2000,
          average_views: 100,
          character_sum: 10000,
          references_count: 20,
          new_article: false,
          rating: "C",
          url: "https://en.wikipedia.org/wiki/Test_Article_2",
          user_ids: [],
        },
      ];

      mockDashboardClient.getArticles = mock(() =>
        Promise.resolve({
          course: { articles: mockArticles },
        } as ArticleData),
      );

      const result = await service.syncArticlesFromDashboard("OKA", "oka");

      expect(result.imported).toBe(2);
      expect(result.updated).toBe(0);
      expect(result.errors).toBe(0);

      expect(mockPrisma.syncJob.update).toHaveBeenCalledWith({
        where: { id: "job-123" },
        data: {
          status: "completed",
          completedAt: expect.any(Date),
          metadata: {
            imported: 2,
            updated: 0,
            errors: 0,
            errorDetails: [],
            errorsSample: [],
          },
        },
      });
    });

    it("should track errors and continue processing", async () => {
      const mockArticles: OutreachArticle[] = [
        {
          id: 100,
          title: "Test_Article_1",
          language: "en",
          project: "wikipedia",
          view_count: 1000,
          average_views: 50,
          character_sum: 5000,
          references_count: 10,
          new_article: true,
          rating: "B",
          url: "https://en.wikipedia.org/wiki/Test_Article_1",
          user_ids: [],
        },
        {
          id: 101,
          title: "Test_Article_2",
          language: "en",
          project: "wikipedia",
          view_count: 2000,
          average_views: 100,
          character_sum: 10000,
          references_count: 20,
          new_article: false,
          rating: "C",
          url: "https://en.wikipedia.org/wiki/Test_Article_2",
          user_ids: [],
        },
      ];

      mockDashboardClient.getArticles = mock(() =>
        Promise.resolve({
          course: { articles: mockArticles },
        } as ArticleData),
      );

      // Make second article fail
      let callCount = 0;
      mockPrisma.article.upsert = mock(() => {
        callCount++;
        if (callCount === 2) {
          throw new Error("Database error");
        }
        return Promise.resolve({
          id: `article-${callCount}`,
          outreachId: 100,
          createdAt: new Date(jobCreatedAt.getTime() + 500),
        });
      }) as unknown as PrismaClient["article"]["upsert"];

      const result = await service.syncArticlesFromDashboard("OKA", "oka");

      expect(result.imported).toBe(1);
      expect(result.errors).toBe(1);
      expect(result.errorDetails).toHaveLength(1);
      expect(result.errorDetails[0].articleId).toBe(101);
      expect(result.errorDetails[0].error).toBe("Database error");
    });

    it("should fail sync job on critical error", async () => {
      mockDashboardClient.getArticles = mock(() => Promise.reject(new Error("Network error")));

      let thrownError: Error | null = null;

      try {
        await service.syncArticlesFromDashboard("OKA", "oka");
      } catch (error) {
        thrownError = error as Error;
      }

      expect(thrownError?.message).toBe("Network error");

      expect(mockPrisma.syncJob.update).toHaveBeenCalledWith({
        where: { id: "job-123" },
        data: {
          status: "failed",
          completedAt: expect.any(Date),
          error: "Network error",
        },
      });
    });

    it("should return sync result with counts", async () => {
      const mockArticles: OutreachArticle[] = [
        {
          id: 100,
          title: "Test_Article",
          language: "en",
          project: "wikipedia",
          view_count: 1000,
          average_views: 50,
          character_sum: 5000,
          references_count: 10,
          new_article: true,
          rating: "B",
          url: "https://en.wikipedia.org/wiki/Test_Article",
          user_ids: [],
        },
      ];

      mockDashboardClient.getArticles = mock(() =>
        Promise.resolve({
          course: { articles: mockArticles },
        } as ArticleData),
      );

      const result = await service.syncArticlesFromDashboard("OKA", "oka");

      expect(result).toEqual({
        imported: 1,
        updated: 0,
        errors: 0,
        errorDetails: [],
      });
    });
  });
});
