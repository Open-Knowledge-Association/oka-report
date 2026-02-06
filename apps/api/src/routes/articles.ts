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
        pageviews: { orderBy: { date: "desc" }, take: 1 },
        _count: { select: { pageviews: true, contributions: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.article.count({ where }),
  ]);

  return c.json({
    success: true,
    data: {
      articles,
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

  const includeDaily = query.source !== "OUTREACH_DASHBOARD";
  const includeCumulative = query.source !== "MEDIAWIKI";

  if (includeDaily) {
    const dailyPageviews = await prisma.pageview.findMany({
      where: {
        type: "DAILY",
        article: {
          source: query.source ?? "MEDIAWIKI",
          ...(query.wikiProject ? { wikiProject: query.wikiProject } : {}),
        },
      },
      select: { views: true, article: { select: { wikiProject: true } } },
    });

    for (const pageview of dailyPageviews) {
      totalPageviews += pageview.views;
      const project = pageview.article.wikiProject;
      wikiPageviews.set(project, (wikiPageviews.get(project) ?? 0) + pageview.views);
    }
  }

  if (includeCumulative) {
    const snapshots = await prisma.pageview.findMany({
      where: {
        type: "CUMULATIVE",
        article: {
          source: query.source ?? "OUTREACH_DASHBOARD",
          ...(query.wikiProject ? { wikiProject: query.wikiProject } : {}),
        },
      },
      select: {
        articleId: true,
        date: true,
        views: true,
        cumulativeViews: true,
        article: { select: { wikiProject: true } },
      },
      orderBy: [{ articleId: "asc" }, { date: "desc" }],
      distinct: ["articleId"],
    });

    for (const snapshot of snapshots) {
      const value = snapshot.cumulativeViews ?? snapshot.views ?? 0;
      totalPageviews += value;
      const project = snapshot.article.wikiProject;
      wikiPageviews.set(project, (wikiPageviews.get(project) ?? 0) + value);
    }
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
