import { Hono } from "hono";
import { prisma } from "@repo/db";
import { z } from "zod";
import { StatsService } from "../services/stats.service";

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
const statsService = new StatsService(prisma);

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
        contributions: {
          select: {
            isCreation: true,
            editor: { select: { id: true, username: true } },
          },
        },
        _count: { select: { pageviews: true, contributions: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.article.count({ where }),
  ]);

  const pageviewsByArticle = await statsService.getCurrentPageviewsForArticles(articles, true);

  const normalizedArticles = articles.map((article) => {
    const totalPageviews = pageviewsByArticle.get(article.id);

    // Build the editors list (frontend expects [{ editor, isAuthor }]).
    const editorsMap = new Map<string, { editor: { id: string; username: string }; isAuthor: boolean }>();
    for (const c of article.contributions ?? []) {
      const existing = editorsMap.get(c.editor.id);
      if (!existing) {
        editorsMap.set(c.editor.id, { editor: c.editor, isAuthor: !!c.isCreation });
      } else if (c.isCreation) {
        existing.isAuthor = true;
      }
    }
    const { contributions: _contributions, ...rest } = article;

    return {
      ...rest,
      editors: Array.from(editorsMap.values()),
      pageviews:
        totalPageviews === undefined
          ? []
          : [{ views: totalPageviews, cumulativeViews: totalPageviews, type: "CUMULATIVE" }],
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

  const { pageviewsByArticle } = await statsService.getCurrentArticleStats(query);
  // Per-wiki breakdown & total: distributed proportionally from the
  // canonical snapshot total (61.38M, cutoff-aware) so this page is
  // consistent with the dashboard & annual report cards.
  const wikiPageviews = await statsService.getPageviewsByWikiProject(query);
  const totalPageviews = Array.from(wikiPageviews.values()).reduce(
    (sum, value) => sum + value,
    0,
  );

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
