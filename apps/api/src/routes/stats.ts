import { Hono } from "hono";
import { prisma } from "@repo/db";
import { OutreachDashboardClient } from "@repo/utils/src/outreach-dashboard";
import { StatsService } from "../services";
import {
  PaginationSchema,
  StatsFilterSchema,
  TimeSeriesSchema,
  HistoryRangeSchema,
  HistoryBackfillSchema,
  EditorHistoryQuerySchema,
  ArticleHistoryQuerySchema,
} from "../schemas";

const dashboardClient = new OutreachDashboardClient({
  baseUrl: "https://outreachdashboard.wmflabs.org",
});

const statsService = new StatsService(prisma);
export const statsRoutes = new Hono();

const withDelta = <T extends Record<string, number | string | Date | null | undefined>>(
  series: T[],
  fields: Array<keyof T>,
) => {
  let prev: T | null = null;
  return series.map((item) => {
    if (!prev) {
      prev = item;
      return { ...item, delta: {} };
    }

    const delta: Record<string, number> = {};
    for (const field of fields) {
      const current = item[field];
      const previous = prev[field];
      if (typeof current === "number" && typeof previous === "number") {
        delta[String(field)] = current - previous;
      }
    }

    prev = item;
    return { ...item, delta };
  });
};

const parseFilters = (input: Record<string, string | undefined>) => {
  const parsed = StatsFilterSchema.parse(input);
  return {
    startDate: parsed.startDate ? new Date(parsed.startDate) : undefined,
    endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
    wikiProject: parsed.wikiProject,
    editorId: parsed.editorId,
    source: parsed.source,
  };
};

statsRoutes.get("/overall", async (c) => {
  const filters = parseFilters(c.req.query());
  const totals = await statsService.getOverallStats(filters);
  const byWikiProject = await statsService.getStatsByWikiProject(filters);

  return c.json({
    success: true,
    data: {
      totals,
      byWikiProject,
    },
    meta: {
      dateRange: {
        start: filters.startDate?.toISOString(),
        end: filters.endDate?.toISOString(),
      },
      generatedAt: new Date().toISOString(),
    },
  });
});

statsRoutes.get("/editors", async (c) => {
  const filters = parseFilters(c.req.query());
  const pagination = PaginationSchema.parse(c.req.query());
  const stats = await statsService.getStatsByEditor(filters);

  const startIndex = (pagination.page - 1) * pagination.limit;
  const paged = stats.slice(startIndex, startIndex + pagination.limit);

  return c.json({
    success: true,
    data: paged,
    meta: {
      total: stats.length,
      page: pagination.page,
      limit: pagination.limit,
    },
  });
});

statsRoutes.get("/editors/:id", async (c) => {
  const filters = parseFilters({ ...c.req.query(), editorId: c.req.param("id") });
  const stats = await statsService.getStatsByEditor(filters);

  if (stats.length === 0) {
    return c.json(
      { success: false, error: { code: "not_found", message: "Editor not found" } },
      404,
    );
  }

  return c.json({ success: true, data: stats[0] });
});

statsRoutes.get("/timeseries", async (c) => {
  const parsed = TimeSeriesSchema.parse(c.req.query());
  const filters = parseFilters(parsed);
  const granularity = parsed.granularity ?? "daily";
  const series = await statsService.getTimeSeries(filters, granularity);

  return c.json({ success: true, data: { granularity, series } });
});

statsRoutes.get("/history", async (c) => {
  const parsed = HistoryRangeSchema.parse(c.req.query());
  const series = await statsService.getDailyHistory({
    startDate: parsed.startDate ? new Date(parsed.startDate) : undefined,
    endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
    wikiProject: parsed.wikiProject,
    source: parsed.source,
  });

  const data = parsed.withDelta
    ? withDelta(series, [
        "edits",
        "wordsAdded",
        "pageviews",
        "articlesCreated",
        "articlesEdited",
        "editors",
        "referencesAdded",
        "commonsUploads",
      ])
    : series;

  return c.json({ success: true, data: { series: data } });
});

statsRoutes.post("/history/backfill", async (c) => {
  const parsed = HistoryBackfillSchema.parse(await c.req.json());
  const startDate = new Date(parsed.startDate);
  const endDate = new Date(parsed.endDate);

  await statsService.recordDailySnapshots(startDate, endDate);

  return c.json({ success: true, data: { startDate, endDate } }, 202);
});

statsRoutes.post("/snapshot", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const dateValue = typeof body?.date === "string" ? new Date(body.date) : null;
  const target = dateValue ?? new Date(Date.now() - 24 * 60 * 60 * 1000);

  await statsService.recordDailySnapshot(target);

  return c.json({
    success: true,
    data: {
      date: target.toISOString(),
    },
  });
});

statsRoutes.get("/editors/history", async (c) => {
  const parsed = EditorHistoryQuerySchema.parse(c.req.query());
  const series = await statsService.getEditorDailyHistory(parsed.editorId, {
    startDate: parsed.startDate ? new Date(parsed.startDate) : undefined,
    endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
  });
  const data = parsed.withDelta
    ? withDelta(series, [
        "edits",
        "wordsAdded",
        "articlesCreated",
        "articlesEdited",
        "referencesAdded",
        "commonsUploads",
      ])
    : series;

  return c.json({ success: true, data: { editorId: parsed.editorId, series: data } });
});

statsRoutes.get("/articles/history", async (c) => {
  const parsed = ArticleHistoryQuerySchema.parse(c.req.query());
  const series = await statsService.getArticleDailyHistory(parsed.articleId, {
    startDate: parsed.startDate ? new Date(parsed.startDate) : undefined,
    endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
  });
  const data = parsed.withDelta
    ? withDelta(series, ["pageviews", "characterSum", "referencesCount"])
    : series;

  return c.json({ success: true, data: { articleId: parsed.articleId, series: data } });
});

statsRoutes.get("/dashboard", async (c) => {
  try {
    const [editorsCount, articlesCreated, articlesEdited, commonsUploads, articleSums, articles] =
      await Promise.all([
        prisma.editor.count({ where: { isActive: true } }),
        prisma.article.count({ where: { isNewArticle: true } }),
        prisma.article.count(),
        prisma.commonsUpload.count(),
        prisma.article.aggregate({
          _sum: {
            characterSum: true,
            referencesCount: true,
          },
        }),
        prisma.article.findMany({
          select: {
            pageviews: {
              where: { type: "CUMULATIVE" },
              orderBy: { date: "desc" },
              take: 1,
              select: { cumulativeViews: true },
            },
          },
        }),
      ]);

    const totalCharacterSum = articleSums._sum.characterSum ?? 0;
    const referencesAdded = articleSums._sum.referencesCount ?? 0;
    const wordsAdded = Math.round(totalCharacterSum / 6);
    const pageviews = articles.reduce(
      (sum, article) => sum + (article.pageviews[0]?.cumulativeViews ?? 0),
      0,
    );

    return c.json({
      success: true,
      data: {
        editorsCount,
        articlesCreated,
        articlesEdited,
        totalEdits: articlesEdited,
        wordsAdded,
        referencesAdded,
        pageviews,
        commonsUploads,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching dashboard stats:", message);

    return c.json(
      {
        success: false,
        error: "Failed to fetch dashboard stats",
        details: message,
      },
      500,
    );
  }
});

statsRoutes.get("/editors-list", async (c) => {
  try {
    const editors = await prisma.editor.findMany({
      where: { isActive: true },
      select: {
        id: true,
        username: true,
        articles: {
          select: {
            article: {
              select: {
                characterSum: true,
                referencesCount: true,
              },
            },
          },
        },
        commonsUploads: {
          select: { id: true },
        },
      },
      orderBy: { username: "asc" },
    });

    const data = editors.map((editor) => {
      const characterSum = editor.articles.reduce(
        (sum, entry) => sum + (entry.article?.characterSum ?? 0),
        0,
      );
      const referencesCount = editor.articles.reduce(
        (sum, entry) => sum + (entry.article?.referencesCount ?? 0),
        0,
      );

      return {
        id: editor.id,
        username: editor.username,
        characterSum,
        referencesCount,
        uploadsCount: editor.commonsUploads.length,
      };
    });

    return c.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching editor list stats:", message);

    return c.json(
      {
        success: false,
        error: "Failed to fetch editor list stats",
        details: message,
      },
      500,
    );
  }
});

/**
 * GET /api/stats/sync-status
 * Returns sync status comparing local DB stats with external Outreach Dashboard
 * Used for dashboard to show data freshness and comparison
 */
statsRoutes.get("/sync-status", async (c) => {
  try {
    const [
      localEditorsCount,
      localArticlesCount,
      localArticlesCreated,
      localSums,
      localArticles,
      lastSyncJob,
      externalCourse,
    ] = await Promise.all([
      prisma.editor.count({ where: { isActive: true } }),
      prisma.article.count(),
      prisma.article.count({ where: { isNewArticle: true } }),
      prisma.article.aggregate({
        _sum: {
          characterSum: true,
          referencesCount: true,
        },
      }),
      prisma.article.findMany({
        select: {
          pageviews: {
            where: { type: "CUMULATIVE" },
            orderBy: { date: "desc" },
            take: 1,
            select: { cumulativeViews: true },
          },
        },
      }),
      prisma.syncJob.findFirst({
        where: { status: "completed" },
        orderBy: { completedAt: "desc" },
        select: {
          id: true,
          jobType: true,
          completedAt: true,
          metadata: true,
        },
      }),
      dashboardClient.getCourse("OKA", "OKA").catch(() => null),
    ]);

    const localPageviews = localArticles.reduce(
      (sum, article) => sum + (article.pageviews[0]?.cumulativeViews ?? 0),
      0,
    );

    const localCharacterSum = localSums._sum.characterSum ?? 0;
    const localReferencesCount = localSums._sum.referencesCount ?? 0;

    const external = externalCourse?.course
      ? {
          editorsCount: externalCourse.course.student_count ?? 0,
          articlesCount: externalCourse.course.article_count ?? 0,
          articlesCreated: externalCourse.course.created_count ?? 0,
          totalEdits:
            parseInt(String(externalCourse.course.edit_count ?? "0").replace(/,/g, ""), 10) || 0,
          wordsAdded:
            parseInt(String(externalCourse.course.word_count ?? "0").replace(/,/g, ""), 10) || 0,
          referencesAdded: externalCourse.course.references_count ?? 0,
          pageviews:
            parseInt(String(externalCourse.course.view_count ?? "0").replace(/,/g, ""), 10) || 0,
          commonsUploads: externalCourse.course.upload_count ?? 0,
        }
      : null;

    return c.json({
      success: true,
      data: {
        local: {
          editorsCount: localEditorsCount,
          articlesCount: localArticlesCount,
          articlesCreated: localArticlesCreated,
          characterSum: localCharacterSum,
          wordsAdded: Math.round(localCharacterSum / 6),
          referencesAdded: localReferencesCount,
          pageviews: localPageviews,
        },
        external,
        lastSync: lastSyncJob
          ? {
              jobType: lastSyncJob.jobType,
              completedAt: lastSyncJob.completedAt,
              metadata: lastSyncJob.metadata,
            }
          : null,
        syncRequired:
          external !== null &&
          (localEditorsCount === 0 ||
            localArticlesCount === 0 ||
            localEditorsCount < external.editorsCount ||
            localArticlesCount < external.articlesCount),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching sync status:", message);

    return c.json(
      {
        success: false,
        error: "Failed to fetch sync status",
        details: message,
      },
      500,
    );
  }
});
