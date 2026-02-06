import { describe, it, expect, beforeEach } from "bun:test";
import { app } from "../index";

describe("API Integration Tests", () => {
  describe("GET /api", () => {
    it("should return API info", async () => {
      const res = await app.request("/");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toBe("OKA Stats API");
    });
  });

  describe("Editors API", () => {
    it("GET /api/editors should return list", async () => {
      const res = await app.request("/api/editors");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe("Stats API", () => {
    it("GET /api/stats/overall should return stats", async () => {
      const res = await app.request("/api/stats/overall");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.totals).toBeDefined();
    });

    it("GET /api/stats/editors should return editor stats", async () => {
      const res = await app.request("/api/stats/editors");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe("Sync API", () => {
    it("GET /api/sync/status should return status", async () => {
      const res = await app.request("/api/sync/status");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  describe("Outreach Articles API", () => {
    beforeEach(async () => {
      const { prisma } = await import("@repo/db");
      await prisma.syncJob.updateMany({
        where: {
          jobType: "outreach_articles",
          status: { in: ["running", "pending"] },
        },
        data: { status: "cancelled" },
      });
    });

    it("POST /api/outreach/articles/sync should trigger article sync", async () => {
      const res = await app.request("/api/outreach/articles/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school: "OKA",
          slug: "OKA",
        }),
      });
      expect(res.status).toBe(202);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.jobId).toBeDefined();
      expect(json.data.status).toBe("accepted");
    });

    it("POST /api/outreach/articles/sync should reject missing school", async () => {
      const res = await app.request("/api/outreach/articles/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "OKA",
        }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("POST /api/outreach/articles/sync should return 409 when sync already running", async () => {
      const { prisma } = await import("@repo/db");

      // First, create a running sync job
      await prisma.syncJob.create({
        data: {
          jobType: "outreach_articles",
          status: "running",
          startedAt: new Date(),
        },
      });

      try {
        // Try to start another sync
        const res = await app.request("/api/outreach/articles/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ school: "OKA", slug: "OKA" }),
        });

        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error).toContain("Sync already in progress");
      } finally {
        // Clean up: remove the test sync job
        await prisma.syncJob.deleteMany({
          where: { jobType: "outreach_articles", status: "running" },
        });
      }
    });

    it.skip("POST /api/outreach/articles/sync should sync articles end-to-end with mocked client", async () => {
      const { prisma } = await import("@repo/db");

      const testArticles = await prisma.article.findMany({
        where: { outreachId: { in: [12345, 12346] } },
        select: { id: true },
      });
      const testArticleIds = testArticles.map((a) => a.id);

      if (testArticleIds.length > 0) {
        await prisma.pageview.deleteMany({ where: { articleId: { in: testArticleIds } } });
        await prisma.articleEditor.deleteMany({ where: { articleId: { in: testArticleIds } } });
        await prisma.contribution.deleteMany({ where: { articleId: { in: testArticleIds } } });
        await prisma.article.deleteMany({ where: { id: { in: testArticleIds } } });
      }

      const mockArticlesData = {
        course: {
          articles: [
            {
              id: 12345,
              title: "Test_Integration_Article",
              language: "en",
              project: "wikipedia",
              view_count: 1000,
              average_views: 50,
              character_sum: 5000,
              references_count: 10,
              new_article: true,
              rating: "B-class",
              url: "https://en.wikipedia.org/wiki/Test_Integration_Article",
              user_ids: [67890],
            },
            {
              id: 12346,
              title: "Another_Test_Article",
              language: "en",
              project: "wikipedia",
              view_count: 2000,
              average_views: 100,
              character_sum: 8000,
              references_count: 15,
              new_article: false,
              rating: "C-class",
              url: "https://en.wikipedia.org/wiki/Another_Test_Article",
              user_ids: [67890, 67891],
            },
          ],
        },
      };

      const { OutreachDashboardClient, WikimediaClient } = await import("@repo/utils");
      const originalGetArticles = OutreachDashboardClient.prototype.getArticles;
      const originalGetArticleInfo = WikimediaClient.prototype.getArticleInfo;

      OutreachDashboardClient.prototype.getArticles = async () => mockArticlesData;
      WikimediaClient.prototype.getArticleInfo = async () => ({
        pageId: 12345,
        title: "Test_Integration_Article",
        creator: "TestUser",
        createdAt: "2024-01-01T00:00:00Z",
      });

      try {
        const syncRes = await app.request("/api/outreach/articles/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            school: "OKA",
            slug: "OKA",
          }),
        });

        expect(syncRes.status).toBe(202);
        const syncJson = await syncRes.json();
        expect(syncJson.success).toBe(true);
        expect(syncJson.data.jobId).toBeDefined();

        let attempts = 0;
        const maxAttempts = 10;
        let jobCompleted = false;

        while (attempts < maxAttempts && !jobCompleted) {
          await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, attempts)));

          const articlesRes = await app.request("/api/outreach/articles/db");
          const articlesJson = await articlesRes.json();

          if (articlesJson.success && articlesJson.data.articles.length >= 2) {
            jobCompleted = true;
            break;
          }

          attempts++;
        }

        expect(jobCompleted).toBe(true);

        const dbRes = await app.request("/api/outreach/articles/db");
        expect(dbRes.status).toBe(200);
        const dbJson = await dbRes.json();
        expect(dbJson.success).toBe(true);

        const testArticle1 = dbJson.data.articles.find((a: any) => a.outreachId === 12345);
        const testArticle2 = dbJson.data.articles.find((a: any) => a.outreachId === 12346);

        expect(testArticle1).toBeDefined();
        expect(testArticle1.title).toBe("Test_Integration_Article");
        expect(testArticle1.language).toBe("en");
        expect(testArticle1.project).toBe("wikipedia");
        expect(testArticle1.characterSum).toBe(5000);
        expect(testArticle1.referencesCount).toBe(10);
        expect(testArticle1.isNewArticle).toBe(true);
        expect(testArticle1.rating).toBe("B-class");

        expect(testArticle2).toBeDefined();
        expect(testArticle2.title).toBe("Another_Test_Article");
        expect(testArticle2.isNewArticle).toBe(false);
        expect(testArticle2.rating).toBe("C-class");
      } finally {
        OutreachDashboardClient.prototype.getArticles = originalGetArticles;
        WikimediaClient.prototype.getArticleInfo = originalGetArticleInfo;
      }
    }, 30000);

    it("GET /api/outreach/articles/db should return paginated articles", async () => {
      const res = await app.request("/api/outreach/articles/db");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data.articles)).toBe(true);
      expect(json.data.pagination).toBeDefined();
      expect(json.data.pagination.total).toBeDefined();
      expect(json.data.pagination.page).toBeDefined();
      expect(json.data.pagination.limit).toBeDefined();
      expect(json.data.pagination.totalPages).toBeDefined();
    });

    it("GET /api/outreach/articles/db should support pagination", async () => {
      const res = await app.request("/api/outreach/articles/db?page=2&limit=10");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.pagination.page).toBe(2);
      expect(json.data.pagination.limit).toBe(10);
    });

    it("GET /api/outreach/articles/db should use default pagination", async () => {
      const res = await app.request("/api/outreach/articles/db");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.pagination.page).toBe(1);
      expect(json.data.pagination.limit).toBe(50);
    });

    it("GET /api/outreach/articles/db should support search", async () => {
      const res = await app.request("/api/outreach/articles/db?search=Test");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.pagination).toBeDefined();
    });

    it("GET /api/outreach/articles/db should support wiki filter", async () => {
      const res = await app.request("/api/outreach/articles/db?wiki=en.wikipedia");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.pagination).toBeDefined();
    });

    it("GET /api/outreach/articles/stats should return global stats", async () => {
      const res = await app.request("/api/outreach/articles/stats");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.totalArticles).toBeDefined();
      expect(json.data.totalPageviews).toBeDefined();
      expect(json.data.uniqueWikis).toBeDefined();
      expect(Array.isArray(json.data.wikiStats)).toBe(true);
    });
  });
});
