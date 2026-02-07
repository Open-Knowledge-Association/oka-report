import { describe, it, expect, beforeEach, mock } from "bun:test";
import { SyncService } from "../sync.service";
import { WikimediaClientError } from "@repo/utils";
import type { PrismaClient } from "@repo/db/generated/prisma/client";
import type { WikimediaClient } from "@repo/utils";

describe("SyncService", () => {
  let service: SyncService;
  let mockPrisma: PrismaClient;
  let mockWikimediaClient: WikimediaClient;

  beforeEach(() => {
    mockPrisma = {
      article: {
        findMany: mock(() => Promise.resolve([])) as unknown as PrismaClient["article"]["findMany"],
      },
      pageview: {
        upsert: mock(() => Promise.resolve({ id: "pv-1" })),
      },
      syncJob: {
        findUnique: mock(() => Promise.resolve({ status: "running" })),
        update: mock(() => Promise.resolve({})),
      },
    } as unknown as PrismaClient;

    mockWikimediaClient = {
      getPageviews: mock(() => Promise.resolve([])),
    } as unknown as WikimediaClient;

    service = new SyncService(mockPrisma, mockWikimediaClient);
  });

  describe("syncArticlePageviews", () => {
    it("should skip article and continue when getPageviews returns 404", async () => {
      // Setup: Single article that returns 404
      mockPrisma.article.findMany = mock(() =>
        Promise.resolve([
          {
            id: "article-1",
            title: "Article_One",
            wikiProject: "en.wikipedia.org",
            createdByEditorId: "editor-1",
          },
        ]),
      ) as unknown as PrismaClient["article"]["findMany"];

      mockWikimediaClient.getPageviews = mock(() =>
        Promise.reject(
          new WikimediaClientError("Not found", {
            status: 404,
            url: "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/Article_One/daily/20240101/20240101",
          }),
        ),
      );

      const result = await service.syncArticlePageviews();

      // Expect 0 pageviews synced (article was skipped)
      expect(result).toBe(0);
      expect(mockPrisma.pageview.upsert).not.toHaveBeenCalled();
    });

    it("should sync multiple articles when middle article returns 404", async () => {
      // Setup: Three articles, middle one returns 404, others succeed
      mockPrisma.article.findMany = mock(() =>
        Promise.resolve([
          {
            id: "article-1",
            title: "Article_One",
            wikiProject: "en.wikipedia.org",
            createdByEditorId: "editor-1",
          },
          {
            id: "article-2",
            title: "Article_Two_NotFound",
            wikiProject: "en.wikipedia.org",
            createdByEditorId: "editor-1",
          },
          {
            id: "article-3",
            title: "Article_Three",
            wikiProject: "en.wikipedia.org",
            createdByEditorId: "editor-1",
          },
        ]),
      ) as unknown as PrismaClient["article"]["findMany"];

      // First call succeeds, second throws 404, third succeeds
      let callCount = 0;
      mockWikimediaClient.getPageviews = mock(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.reject(
            new WikimediaClientError("Not found", {
              status: 404,
              url: "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/Article_Two_NotFound/daily/20240101/20240101",
            }),
          );
        }
        return Promise.resolve([{ date: "20240101", views: 100 + callCount * 10 }]);
      });

      const result = await service.syncArticlePageviews();

      expect(result).toBe(5);
      expect(mockPrisma.pageview.upsert).toHaveBeenCalledTimes(5);
    });

    it("should propagate non-404 errors and fail sync", async () => {
      // Setup: Single article that throws a 500 error
      mockPrisma.article.findMany = mock(() =>
        Promise.resolve([
          {
            id: "article-1",
            title: "Article_One",
            wikiProject: "en.wikipedia.org",
            createdByEditorId: "editor-1",
          },
        ]),
      ) as unknown as PrismaClient["article"]["findMany"];

      mockWikimediaClient.getPageviews = mock(() =>
        Promise.reject(
          new WikimediaClientError("Internal Server Error", {
            status: 500,
            url: "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/Article_One/daily/20240101/20240101",
          }),
        ),
      );

      let thrownError: Error | null = null;

      try {
        await service.syncArticlePageviews();
      } catch (error) {
        thrownError = error as Error;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError?.message).toBe("Internal Server Error");
      expect(mockPrisma.pageview.upsert).not.toHaveBeenCalled();
    });

    it("should complete successfully when all articles return 404", async () => {
      // Setup: Multiple articles, all return 404
      mockPrisma.article.findMany = mock(() =>
        Promise.resolve([
          {
            id: "article-1",
            title: "Article_One_NotFound",
            wikiProject: "en.wikipedia.org",
            createdByEditorId: "editor-1",
          },
          {
            id: "article-2",
            title: "Article_Two_NotFound",
            wikiProject: "en.wikipedia.org",
            createdByEditorId: "editor-1",
          },
          {
            id: "article-3",
            title: "Article_Three_NotFound",
            wikiProject: "en.wikipedia.org",
            createdByEditorId: "editor-1",
          },
        ]),
      ) as unknown as PrismaClient["article"]["findMany"];

      mockWikimediaClient.getPageviews = mock(() =>
        Promise.reject(
          new WikimediaClientError("Not found", {
            status: 404,
            url: "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/Article_NotFound/daily/20240101/20240101",
          }),
        ),
      );

      const result = await service.syncArticlePageviews();

      // Expect 0 pageviews synced (all articles skipped due to 404)
      expect(result).toBe(0);
      expect(mockPrisma.pageview.upsert).not.toHaveBeenCalled();
    });

    it("should handle empty article list", async () => {
      // Setup: No articles to sync
      mockPrisma.article.findMany = mock(() =>
        Promise.resolve([]),
      ) as unknown as PrismaClient["article"]["findMany"];

      const result = await service.syncArticlePageviews();

      // Expect 0 pageviews synced
      expect(result).toBe(0);
      expect(mockWikimediaClient.getPageviews).not.toHaveBeenCalled();
      expect(mockPrisma.pageview.upsert).not.toHaveBeenCalled();
    });

    it("should sync pageviews successfully when no 404 errors occur", async () => {
      // Setup: Two articles, both succeed
      mockPrisma.article.findMany = mock(() =>
        Promise.resolve([
          {
            id: "article-1",
            title: "Article_One",
            wikiProject: "en.wikipedia.org",
            createdByEditorId: "editor-1",
          },
          {
            id: "article-2",
            title: "Article_Two",
            wikiProject: "en.wikipedia.org",
            createdByEditorId: "editor-1",
          },
        ]),
      ) as unknown as PrismaClient["article"]["findMany"];

      mockWikimediaClient.getPageviews = mock(() =>
        Promise.resolve([
          { date: "20240101", views: 100 },
          { date: "20240102", views: 150 },
        ]),
      );

      const result = await service.syncArticlePageviews();

      expect(result).toBe(8);
      expect(mockPrisma.pageview.upsert).toHaveBeenCalledTimes(8);

      const getPageviewsCalls = mockWikimediaClient.getPageviews.mock.calls;
      expect(getPageviewsCalls.length).toBe(4);

      const agentTypes = getPageviewsCalls.map((call: any) => call[4]);
      expect(agentTypes).toContain("all-agents");
      expect(agentTypes).toContain("user");
    });
  });
});
