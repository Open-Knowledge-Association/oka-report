import { describe, expect, it } from "bun:test";
import type { PrismaClient } from "@repo/db/generated/prisma/client";
import { StatsService } from "../stats.service";

describe("StatsService canonical current metrics", () => {
  it("uses contribution semantics and source-aware lifetime pageviews", async () => {
    const prisma = {
      editor: { count: async () => 2 },
      article: {
        findMany: async () => [
          { id: "outreach", source: "OUTREACH_DASHBOARD" },
          { id: "mediawiki", source: "MEDIAWIKI" },
        ],
        aggregate: async () => ({ _sum: { referencesCount: 12 } }),
      },
      contribution: {
        findMany: async () => [
          { articleId: "outreach", isCreation: true, wordsAdded: 10 },
          { articleId: "outreach", isCreation: false, wordsAdded: 5 },
          { articleId: "mediawiki", isCreation: false, wordsAdded: 7 },
        ],
      },
      commonsUpload: { count: async () => 4 },
      pageview: {
        groupBy: async () => [
          { articleId: "outreach", _sum: { views: 30 } },
          { articleId: "mediawiki", _sum: { views: 70 } },
        ],
        findMany: async () => [{ articleId: "outreach", views: 100, cumulativeViews: 120 }],
      },
    } as unknown as PrismaClient;

    const result = await new StatsService(prisma).getCurrentDatasetStats();

    expect(result).toEqual({
      editorsCount: 2,
      articlesCreated: 1,
      articlesEdited: 2,
      totalArticles: 2,
      totalEdits: 3,
      wordsAdded: 22,
      referencesAdded: 12,
      pageviews: 190,
      commonsUploads: 4,
    });
  });
});
