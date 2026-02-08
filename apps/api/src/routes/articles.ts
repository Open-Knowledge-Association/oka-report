import { Hono } from "hono";
import { prisma } from "@repo/db";
import { z } from "zod";

const ArticlesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  source: z.enum(["MEDIAWIKI", "OUTREACH_DASHBOARD"]).optional(),
  wikiProject: z.string().optional(),
  search: z.string().optional(),
});

const ArticlesStatsQuerySchema = z.object({
  source: z.enum(["MEDIAWIKI", "OUTREACH_DASHBOARD"]).optional(),
  wikiProject: z.string().optional(),
});

export const articlesRoutes = new Hono();

const getCurrentPageviewValue = (
  row: { views: number; cumulativeViews?: number | null } | null | undefined,
) => row?.cumulativeViews ?? row?.views ?? 0;

// GET /api/articles - List articles with pagination
articlesRoutes.get("/", async (c) => {
  const query = ArticlesQuerySchema.parse(c.req.query());
  const offset = (query.page - 1) * query.limit;

  const where: any = {
    ...(query.source ? { source: query.source } : {}),
    ...(query.wikiProject ? { wikiProject: query.wikiProject } : {}),
    ...(query.search ? { title: { contains: query.search, mode: "insensitive" } } : {}),
  };

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      skip: offset,
      take: query.limit,
      include: {
        createdByEditor: { select: { id: true, username: true } },
        editors: { include: { editor: { select: { id: true, username: true } } } },
        _count: { select: { pageviews: true, contributions: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.article.count({ where }),
  ]);

  const articleIds = articles.map((article) => article.id);

  const [latestDaily, latestCumulative] = await Promise.all([
    articleIds.length > 0
      ? prisma.pageview.findMany({
          where: {
            articleId: { in: articleIds },
            type: "DAILY",
            agentType: "ALL_AGENTS",
          },
          orderBy: [{ articleId: "asc" }, { date: "desc" }],
          distinct: ["articleId"],
        })
      : Promise.resolve([]),
    articleIds.length > 0
      ? prisma.pageview.findMany({
          where: {
            articleId: { in: articleIds },
            type: "CUMULATIVE",
            agentType: "ALL_AGENTS",
          },
          orderBy: [{ articleId: "asc" }, { date: "desc" }],
          distinct: ["articleId"],
        })
      : Promise.resolve([]),
  ]);

  const dailyByArticleId = new Map(latestDaily.map((row) => [row.articleId, row]));
  const cumulativeByArticleId = new Map(latestCumulative.map((row) => [row.articleId, row]));

  const normalizedArticles = articles.map((article) => {
    const selectedPageview =
      article.source === "OUTREACH_DASHBOARD"
        ? (cumulativeByArticleId.get(article.id) ?? dailyByArticleId.get(article.id))
        : (dailyByArticleId.get(article.id) ?? cumulativeByArticleId.get(article.id));

    return {
      ...article,
      pageviews: selectedPageview ? [selectedPageview] : [],
    };
  });

  return c.json({
    success: true,
    data: {
      articles: normalizedArticles,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    },
  });
});

// GET /api/articles/stats - Article statistics aggregation
articlesRoutes.get("/stats", async (c) => {
  const query = ArticlesStatsQuerySchema.parse(c.req.query());

  const articleWhere = {
    ...(query.source ? { source: query.source } : {}),
    ...(query.wikiProject ? { wikiProject: query.wikiProject } : {}),
  };

  const totalArticles = await prisma.article.count({ where: articleWhere });

  let totalPageviews = 0;
  const wikiPageviews = new Map<string, number>();

  const articles = await prisma.article.findMany({
    where: articleWhere,
    select: {
      id: true,
      wikiProject: true,
      source: true,
    },
  });

  const [latestDaily, latestCumulative] = await Promise.all([
    prisma.pageview.findMany({
      where: {
        type: "DAILY",
        agentType: "ALL_AGENTS",
      },
      select: { articleId: true, date: true, views: true },
      orderBy: [{ articleId: "asc" }, { date: "desc" }],
      distinct: ["articleId"],
    }),
    prisma.pageview.findMany({
      where: {
        type: "CUMULATIVE",
        agentType: "ALL_AGENTS",
      },
      select: { articleId: true, date: true, views: true, cumulativeViews: true },
      orderBy: [{ articleId: "asc" }, { date: "desc" }],
      distinct: ["articleId"],
    }),
  ]);

  const dailyByArticleId = new Map(latestDaily.map((row) => [row.articleId, row]));
  const cumulativeByArticleId = new Map(latestCumulative.map((row) => [row.articleId, row]));

  for (const article of articles) {
    const selected =
      article.source === "OUTREACH_DASHBOARD"
        ? (cumulativeByArticleId.get(article.id) ?? dailyByArticleId.get(article.id))
        : (dailyByArticleId.get(article.id) ?? cumulativeByArticleId.get(article.id));

    if (!selected) {
      continue;
    }

    const value = getCurrentPageviewValue(selected);
    totalPageviews += value;
    wikiPageviews.set(article.wikiProject, (wikiPageviews.get(article.wikiProject) ?? 0) + value);
  }

  const wikiCounts = await prisma.article.groupBy({
    by: ["wikiProject"],
    where: articleWhere,
    _count: { _all: true },
  });

  const wikiStats = wikiCounts
    .map((entry) => ({
      wiki: entry.wikiProject,
      count: entry._count._all,
      pageviews: wikiPageviews.get(entry.wikiProject) ?? 0,
    }))
    .sort((a, b) => a.wiki.localeCompare(b.wiki));

  return c.json({
    success: true,
    data: {
      totalArticles,
      totalPageviews,
      uniqueWikis: wikiStats.length,
      wikiStats,
    },
  });
});

// GET /api/articles/:id - Get single article with relations
articlesRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      createdByEditor: { select: { id: true, username: true } },
      editors: { include: { editor: { select: { id: true, username: true } } } },
      pageviews: { orderBy: { date: "desc" }, take: 30 },
      contributions: {
        orderBy: { editTimestamp: "desc" },
        take: 10,
        include: { editor: { select: { id: true, username: true } } },
      },
    },
  });

  if (!article) {
    return c.json(
      { success: false, error: { code: "not_found", message: "Article not found" } },
      404,
    );
  }

  return c.json({ success: true, data: article });
});
