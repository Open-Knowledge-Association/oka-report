import { Hono } from "hono";
import { ZodError } from "zod";
import { prisma } from "@repo/db";
import { OutreachDashboardClient } from "@repo/utils/src/outreach-dashboard";
import { StatsService } from "../services";
import { ReportExportService } from "../services/report-export.service";
import {
  PaginationSchema,
  StatsFilterSchema,
  TimeSeriesSchema,
  HistoryRangeSchema,
  HistoryBackfillSchema,
  EditorHistoryQuerySchema,
  ArticleHistoryQuerySchema,
  AnnualStatsQuerySchema,
  MonthlyStatsQuerySchema,
  MonthlyExportQuerySchema,
  TopArticlesQuerySchema,
  ReportExportQuerySchema,
} from "../schemas";

const dashboardClient = new OutreachDashboardClient({
  baseUrl: "https://outreachdashboard.wmflabs.org",
});

const statsService = new StatsService(prisma);

const parseExternalMetric = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const raw = String(value ?? "0").trim();
  if (!raw) {
    return 0;
  }

  const suffixMatch = raw.match(/^(-?[0-9]+(?:\.[0-9]+)?)\s*([kKmMbB])$/);
  if (suffixMatch) {
    const numeric = Number.parseFloat(suffixMatch[1]);
    if (!Number.isFinite(numeric)) {
      return 0;
    }

    const suffix = suffixMatch[2].toUpperCase();
    const multiplier = suffix === "K" ? 1_000 : suffix === "M" ? 1_000_000 : 1_000_000_000;
    return Math.round(numeric * multiplier);
  }

  const normalized = raw.replace(/,/g, "");
  const numeric = Number.parseFloat(normalized);
  if (Number.isFinite(numeric)) {
    return Math.round(numeric);
  }

  const cleaned = raw.replace(/[^0-9-]/g, "");
  if (!cleaned || cleaned === "-") {
    return 0;
  }

  const parsed = Number.parseInt(cleaned, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};
const reportExportService = new ReportExportService(prisma);
export const statsRoutes = new Hono();

type ExternalSnapshot = {
  fetchedAt: string;
  participants: Array<{
    username: string;
    enrolledAt: string | null;
    totalUploads: number;
  }>;
  courseRaw: {
    student_count: unknown;
    article_count: unknown;
    created_count: unknown;
    edit_count: unknown;
    word_count: unknown;
    references_count: unknown;
    view_count: unknown;
    upload_count: unknown;
  };
  precise: {
    editorsCount: number;
    articlesCount: number;
    articlesCreated: number;
    wordsAdded: number;
    referencesAdded: number;
    pageviews: number;
    commonsUploads: number;
  };
};

let externalSnapshotCache: { value: ExternalSnapshot; fetchedAtMs: number } | null = null;
const EXTERNAL_SNAPSHOT_TTL_MS = 10 * 60 * 1000;

const getExternalSnapshot = async (): Promise<ExternalSnapshot | null> => {
  const now = Date.now();
  if (externalSnapshotCache && now - externalSnapshotCache.fetchedAtMs < EXTERNAL_SNAPSHOT_TTL_MS) {
    return externalSnapshotCache.value;
  }

  const [courseData, usersData, articleData] = await Promise.all([
    dashboardClient.getCourse("OKA", "OKA"),
    dashboardClient.getUsers("OKA", "OKA"),
    dashboardClient.getArticles("OKA", "OKA"),
  ]);

  const course = courseData.course;
  const participants = (usersData.course?.users ?? usersData.users ?? []).filter(
    (user) => user.role === 0,
  );
  const normalizedParticipants = participants.map((user) => ({
    username: String(user.username).replace(/\s+/g, "_").toLowerCase(),
    enrolledAt: typeof user.enrolled_at === "string" ? user.enrolled_at : null,
    totalUploads: parseExternalMetric(user.total_uploads),
  }));
  const articles = articleData.course?.articles ?? [];

  const precise = {
    editorsCount: parseExternalMetric(course.student_count),
    articlesCount: articles.length,
    articlesCreated: articles.filter((article) => Boolean(article.new_article)).length,
    wordsAdded: Math.round(
      articles.reduce((sum, article) => sum + (article.character_sum ?? 0), 0) / 6,
    ),
    referencesAdded: articles.reduce((sum, article) => sum + (article.references_count ?? 0), 0),
    pageviews: articles.reduce((sum, article) => sum + (article.view_count ?? 0), 0),
    commonsUploads: normalizedParticipants.reduce((sum, user) => sum + user.totalUploads, 0),
  };

  const snapshot: ExternalSnapshot = {
    fetchedAt: new Date().toISOString(),
    participants: normalizedParticipants,
    courseRaw: {
      student_count: course.student_count,
      article_count: course.article_count,
      created_count: course.created_count,
      edit_count: course.edit_count,
      word_count: course.word_count,
      references_count: course.references_count,
      view_count: course.view_count,
      upload_count: course.upload_count,
    },
    precise,
  };

  externalSnapshotCache = { value: snapshot, fetchedAtMs: now };
  return snapshot;
};

const getExternalSnapshotWithTimeout = async (timeoutMs = 5000): Promise<ExternalSnapshot | null> => {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  return Promise.race([getExternalSnapshot().catch(() => null), timeout]);
};

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


statsRoutes.get("/editors/:id", async (c) => {
  const filters = parseFilters({ ...c.req.query(), editorId: c.req.param("id") });
  const stats = await statsService.getStatsByEditor(filters);

  if (stats.length === 0) {
    return c.json(
      { success: false, error: { code: "not_found", message: "Editor not found" } },
      404,
    );
  }

  return c.json({ success: true, data: stats });
});

statsRoutes.get("/annual/export", async (c) => {
  try {
    const parsed = ReportExportQuerySchema.parse(c.req.query());
    const { year, format, wikiProject } = parsed;

    const impact = !wikiProject ? await statsService.getImpactReport(year, 10, true) : null;
    const stats = impact ?? await statsService.getAnnualStats(year, { wikiProject });
    const topArticles = impact?.topArticles ?? await statsService.getTopArticlesByYear(year, 10, wikiProject);

    const reportData = {
      year,
      byWikiProject: stats.byWikiProject,
      totals: stats.totals,
      topArticles,
    } as import("../services/report-export.service").AnnualReportData;

    if (format === "pdf") {
      const pdfBuffer = await reportExportService.exportPDF(reportData);
      return new Response(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="oka-annual-report-${year}.pdf"`,
        },
      });
    }

    if (format === "csv") {
      const csvContent = await reportExportService.exportCSV(reportData);
      return new Response(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="oka-annual-report-${year}.csv"`,
        },
      });
    }

    if (format === "json") {
      const jsonContent = await reportExportService.exportJSON(reportData);
      return new Response(jsonContent, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="oka-annual-report-${year}.json"`,
        },
      });
    }

    return c.json(
      {
        success: false,
        error: "Invalid format",
      },
      400,
    );
  } catch (error) {
    if (error instanceof ZodError || (error instanceof Error && error.name === "ZodError")) return c.json({ success: false, error: "Invalid query parameters" }, 400);
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error exporting report:", message);

    return c.json(
      {
        success: false,
        error: "Failed to export report",
        details: message,
      },
      500,
    );
  }
});

statsRoutes.get("/monthly/export", async (c) => {
  try {
    const parsed = MonthlyExportQuerySchema.parse(c.req.query());
    const { year, month, format, wikiProject } = parsed;

    const stats = await statsService.getMonthlyStats(year, month, { wikiProject });
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, month, 1) - 1);
    const topArticles = await statsService.getTopArticlesByPeriod(
      startOfMonth,
      endOfMonth,
      10,
      wikiProject,
    );

    const reportData = {
      year,
      month,
      byWikiProject: stats.byWikiProject,
      totals: stats.totals,
      topArticles,
    };

    if (format === "pdf") {
      const pdfBuffer = await reportExportService.exportPDF(reportData as any);
      return new Response(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="oka-monthly-report-${year}-${month}.pdf"`,
        },
      });
    }

    if (format === "csv") {
      const csvContent = await reportExportService.exportCSV(reportData as any);
      return new Response(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="oka-monthly-report-${year}-${month}.csv"`,
        },
      });
    }

    if (format === "json") {
      const jsonContent = await reportExportService.exportJSON(reportData as any);
      return new Response(jsonContent, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="oka-monthly-report-${year}-${month}.json"`,
        },
      });
    }

    return c.json(
      {
        success: false,
        error: "Invalid format",
      },
      400,
    );
  } catch (error) {
    if (error instanceof ZodError || (error instanceof Error && error.name === "ZodError")) return c.json({ success: false, error: "Invalid query parameters" }, 400);
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error exporting monthly report:", message);

    return c.json(
      {
        success: false,
        error: "Failed to export monthly report",
        details: message,
      },
      500,
    );
  }
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

statsRoutes.get("/annual-impact", async (c) => {
  try {
    const year = Number(c.req.query("year") ?? new Date().getUTCFullYear() - 1);
    const limit = Math.min(50, Math.max(1, Number(c.req.query("limit") ?? 10)));
    const includeMonthly = c.req.query("includeMonthly") === "true";
    if (!Number.isInteger(year) || year < 2020 || year > 2100) return c.json({ success: false, error: "Invalid year" }, 400);
    return c.json({ success: true, data: await statsService.getImpactReport(year, limit, includeMonthly) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching annual impact report:", message);
    return c.json({ success: false, error: "Failed to fetch annual impact report" }, 500);
  }
});

statsRoutes.get("/annual", async (c) => {
  const parsed = AnnualStatsQuerySchema.parse(c.req.query());
  const year = parsed.year;

  // Keep the unfiltered annual contract aligned with the canonical impact
  // report used by the public and admin report screens. Filtered legacy queries
  // remain available for explicit wiki/source drill-downs.
  const canonical = !parsed.wikiProject && !parsed.source
    ? await statsService.getImpactReport(year, 10, true)
    : null;
  const stats = canonical ? null : await statsService.getAnnualStats(year, {
    wikiProject: parsed.wikiProject,
    source: parsed.source,
  });

  let yoy = undefined;
  if (parsed.includeYoY) {
    yoy = await statsService.calculateYoY(year);
  }

  return c.json({
    success: true,
    data: {
      year,
      byWikiProject: canonical?.byWikiProject ?? stats!.byWikiProject,
      totals: canonical?.totals ?? stats!.totals,
      monthlyPerformance: canonical?.monthlyPerformance ?? stats!.monthlyPerformance,
      ...(yoy && { yoy }),
    },
  });
});

statsRoutes.get("/monthly", async (c) => {
  try {
    const parsed = MonthlyStatsQuerySchema.parse(c.req.query());
    const { year, month } = parsed;

    const stats = await statsService.getMonthlyStats(year, month, {
      wikiProject: parsed.wikiProject,
      source: parsed.source,
    });

    let mom = undefined;
    if (parsed.includeMoM) {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const prevStats = await statsService.getMonthlyStats(prevYear, prevMonth, {
        wikiProject: parsed.wikiProject,
        source: parsed.source,
      });

      mom = {
        articlesCreated: {
          current: stats.totals.articlesCreated,
          previous: prevStats.totals.articlesCreated,
          changePercent:
            prevStats.totals.articlesCreated > 0
              ? ((stats.totals.articlesCreated - prevStats.totals.articlesCreated) /
                  prevStats.totals.articlesCreated) *
                100
              : 0,
        },
        articlesEdited: {
          current: stats.totals.articlesEdited,
          previous: prevStats.totals.articlesEdited,
          changePercent:
            prevStats.totals.articlesEdited > 0
              ? ((stats.totals.articlesEdited - prevStats.totals.articlesEdited) /
                  prevStats.totals.articlesEdited) *
                100
              : 0,
        },
        edits: {
          current: stats.totals.edits,
          previous: prevStats.totals.edits,
          changePercent:
            prevStats.totals.edits > 0
              ? ((stats.totals.edits - prevStats.totals.edits) / prevStats.totals.edits) * 100
              : 0,
        },
        wordsAdded: {
          current: stats.totals.wordsAdded,
          previous: prevStats.totals.wordsAdded,
          changePercent:
            prevStats.totals.wordsAdded > 0
              ? ((stats.totals.wordsAdded - prevStats.totals.wordsAdded) /
                  prevStats.totals.wordsAdded) *
                100
              : 0,
        },
      };
    }

    return c.json({
      success: true,
      data: {
        year,
        month,
        byWikiProject: stats.byWikiProject,
        totals: stats.totals,
        dailyPerformance: stats.dailyPerformance,
        ...(mom && { mom }),
      },
    });
  } catch (error) {
    if (error instanceof ZodError || (error instanceof Error && error.name === "ZodError")) return c.json({ success: false, error: "Invalid query parameters" }, 400);
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching monthly stats:", message);
    return c.json(
      { success: false, error: "Failed to fetch monthly stats", details: message },
      500,
    );
  }
});

statsRoutes.get("/top-articles", async (c) => {
  try {
    const parsed = TopArticlesQuerySchema.parse(c.req.query());
    const { year, month, wikiProject, limit } = parsed;

    const articles = month
      ? await statsService.getTopArticlesByPeriod(
          new Date(Date.UTC(year, month - 1, 1)),
          new Date(Date.UTC(year, month, 1) - 1),
          limit,
          wikiProject,
        )
      : await statsService.getTopArticlesByYear(year, limit, wikiProject);

    return c.json({
      success: true,
      data: {
        year,
        month: month ?? null,
        wikiProject: wikiProject ?? null,
        articles: articles.map((article) => ({
          rank: article.rank,
          title: article.title,
          wikiProject: article.wikiProject,
          totalPageviews: article.totalPageviews,
          articleId: article.articleId,
        })),
        totalCount: articles.length,
      },
    });
  } catch (error) {
    if (error instanceof ZodError || (error instanceof Error && error.name === "ZodError")) return c.json({ success: false, error: "Invalid query parameters" }, 400);
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching top articles:", message);

    return c.json(
      {
        success: false,
        error: { code: "top_articles_failed", message: "Failed to fetch top articles" },
      },
      500,
    );
  }
});

statsRoutes.post("/history/backfill", async (c) => {
  const parsed = HistoryBackfillSchema.parse(await c.req.json());
  const startDate = new Date(parsed.startDate);
  const endDate = new Date(parsed.endDate);

  const job = await prisma.syncJob.create({
    data: {
      jobType: "history_backfill",
      status: "pending",
      metadata: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        processed: 0,
        total: Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1),
      } as any,
    },
  });

  return c.json({ success: true, data: { jobId: job.id, startDate, endDate, status: "pending" } }, 202);
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
    const [
      editorsCount,
      articlesCreated,
      articlesEdited,
      totalEdits,
      commonsUploads,
      articleSums,
      articles,
      createdArticles,
      editedOnlyArticles,
    ] = await Promise.all([
      prisma.editor.count({ where: { isActive: true } }),
      prisma.article.count({ where: { isNewArticle: true } }),
      prisma.article.count(),
      prisma.contribution.count(),
      prisma.commonsUpload.count(),
      prisma.article.aggregate({
        _sum: {
          characterSum: true,
          referencesCount: true,
        },
      }),
      prisma.article.findMany({
        select: {
          id: true,
          source: true,
        },
      }),
      prisma.article.findMany({
        where: { createdByEditorId: { not: null } },
        select: {
          id: true,
          source: true,
        },
      }),
      prisma.article.findMany({
        where: {
          createdByEditorId: null,
          editors: { some: { editor: { isActive: true } } },
        },
        select: {
          id: true,
          source: true,
        },
      }),
    ]);

    const totalCharacterSum = articleSums._sum.characterSum ?? 0;
    const referencesAdded = articleSums._sum.referencesCount ?? 0;
    const wordsAdded = Math.round(totalCharacterSum / 6);
    const [latestDaily, latestCumulative] = await Promise.all([
      prisma.pageview.findMany({
        where: {
          type: "DAILY",
          agentType: "ALL_AGENTS",
        },
        select: { articleId: true, views: true, date: true },
        orderBy: [{ articleId: "asc" }, { date: "desc" }],
        distinct: ["articleId"],
      }),
      prisma.pageview.findMany({
        where: {
          type: "CUMULATIVE",
          agentType: "ALL_AGENTS",
        },
        select: { articleId: true, views: true, cumulativeViews: true, date: true },
        orderBy: [{ articleId: "asc" }, { date: "desc" }],
        distinct: ["articleId"],
      }),
    ]);

    const dailyByArticleId = new Map(latestDaily.map((row) => [row.articleId, row]));
    const cumulativeByArticleId = new Map(latestCumulative.map((row) => [row.articleId, row]));

    const calculatePageviews = (articleList: typeof articles) => {
      return articleList.reduce((sum, article) => {
        const selected =
          article.source === "OUTREACH_DASHBOARD"
            ? (cumulativeByArticleId.get(article.id) ?? dailyByArticleId.get(article.id))
            : (dailyByArticleId.get(article.id) ?? cumulativeByArticleId.get(article.id));
        const value = selected
          ? (((selected as any).cumulativeViews as number | null | undefined) ??
            selected.views ??
            0)
          : 0;
        return sum + value;
      }, 0);
    };

    const pageviews = calculatePageviews(articles);
    const pageviewsFromCreatedArticles = calculatePageviews(createdArticles);
    const pageviewsFromEditedArticles = calculatePageviews(editedOnlyArticles);

    return c.json({
      success: true,
      data: {
        editorsCount,
        articlesCreated,
        articlesEdited,
        totalEdits,
        wordsAdded,
        referencesAdded,
        pageviews,
        pageviewsFromCreatedArticles,
        pageviewsFromEditedArticles,
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
    const trackedJobTypes = [
      "full",
      "editors",
      "outreach_articles",
      "contributions",
      "pageviews",
      "commons",
      "history_backfill",
    ] as const;

    const [
      localEditorsCount,
      localArticlesCount,
      localArticlesCreated,
      localSums,
      localArticles,
      localEditors,
      localCommonsUploads,
      lastSyncJob,
      externalSnapshot,
      recentJobs,
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
          id: true,
          source: true,
        },
      }),
      prisma.editor.findMany({
        where: { isActive: true },
        select: { id: true, username: true },
      }),
      prisma.commonsUpload.count(),
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
      getExternalSnapshotWithTimeout(),
      prisma.syncJob.findMany({
        where: { jobType: { in: [...trackedJobTypes] } },
        orderBy: { createdAt: "desc" },
        take: 80,
        select: {
          id: true,
          jobType: true,
          status: true,
          createdAt: true,
          startedAt: true,
          completedAt: true,
          error: true,
          metadata: true,
        },
      }),
    ]);

    const [latestDaily, latestCumulative] = await Promise.all([
      prisma.pageview.findMany({
        where: {
          type: "DAILY",
          agentType: "ALL_AGENTS",
        },
        select: { articleId: true, views: true, date: true },
        orderBy: [{ articleId: "asc" }, { date: "desc" }],
        distinct: ["articleId"],
      }),
      prisma.pageview.findMany({
        where: {
          type: "CUMULATIVE",
          agentType: "ALL_AGENTS",
        },
        select: { articleId: true, views: true, cumulativeViews: true, date: true },
        orderBy: [{ articleId: "asc" }, { date: "desc" }],
        distinct: ["articleId"],
      }),
    ]);

    const dailyByArticleId = new Map(latestDaily.map((row) => [row.articleId, row]));
    const cumulativeByArticleId = new Map(latestCumulative.map((row) => [row.articleId, row]));

    const localPageviews = localArticles.reduce((sum, article) => {
      const selected =
        article.source === "OUTREACH_DASHBOARD"
          ? (cumulativeByArticleId.get(article.id) ?? dailyByArticleId.get(article.id))
          : (dailyByArticleId.get(article.id) ?? cumulativeByArticleId.get(article.id));
      const value = selected
        ? (((selected as any).cumulativeViews as number | null | undefined) ?? selected.views ?? 0)
        : 0;
      return sum + value;
    }, 0);

    const localCharacterSum = localSums._sum.characterSum ?? 0;
    const localReferencesCount = localSums._sum.referencesCount ?? 0;

    const localUploadsComparable = externalSnapshot
      ? await (async () => {
          const participantMap = new Map(
            externalSnapshot.participants.map((participant) => [
              participant.username,
              participant.enrolledAt ? new Date(participant.enrolledAt) : null,
            ]),
          );

          const participantEditors = localEditors
            .map((editor) => ({
              id: editor.id,
              enrolledAt: participantMap.get(editor.username.toLowerCase()),
            }))
            .filter((editor) => editor.enrolledAt !== undefined);

          const participantEditorIds = participantEditors.map((editor) => editor.id);

          if (participantEditorIds.length === 0) {
            return 0;
          }

          const uploads = await prisma.commonsUpload.findMany({
            where: {
              editorId: { in: participantEditorIds },
            },
            select: {
              editorId: true,
              uploadedAt: true,
            },
          });

          const enrolledAtByEditorId = new Map(
            participantEditors.map((editor) => [editor.id, editor.enrolledAt]),
          );

          return uploads.reduce((sum, upload) => {
            const enrolledAt = enrolledAtByEditorId.get(upload.editorId);
            if (!enrolledAt || upload.uploadedAt >= enrolledAt) {
              return sum + 1;
            }
            return sum;
          }, 0);
        })()
      : localCommonsUploads;

    const external = externalSnapshot
      ? {
          editorsCount: externalSnapshot.precise.editorsCount,
          articlesCount: externalSnapshot.precise.articlesCount,
          articlesCreated: externalSnapshot.precise.articlesCreated,
          totalEdits: parseExternalMetric(externalSnapshot.courseRaw.edit_count),
          wordsAdded: externalSnapshot.precise.wordsAdded,
          referencesAdded: externalSnapshot.precise.referencesAdded,
          pageviews: externalSnapshot.precise.pageviews,
          commonsUploads: externalSnapshot.precise.commonsUploads,
        }
      : null;

    const externalRaw = externalSnapshot
      ? {
          ...externalSnapshot.courseRaw,
          fetchedAt: externalSnapshot.fetchedAt,
          precise_from_articles: {
            editorsCount: externalSnapshot.precise.editorsCount,
            articlesCount: externalSnapshot.precise.articlesCount,
            articlesCreated: externalSnapshot.precise.articlesCreated,
            wordsAdded: externalSnapshot.precise.wordsAdded,
            referencesAdded: externalSnapshot.precise.referencesAdded,
            pageviews: externalSnapshot.precise.pageviews,
            commonsUploads: externalSnapshot.precise.commonsUploads,
          },
        }
      : null;

    const latestByType = trackedJobTypes
      .map((jobType) => {
        const job = recentJobs.find((candidate) => candidate.jobType === jobType);
        if (!job) return null;
        return {
          jobType,
          id: job.id,
          status: job.status,
          createdAt: job.createdAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          error: job.error,
          metadata: job.metadata,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const activeJobs = recentJobs
      .filter((job) => job.status === "running" || job.status === "pending")
      .map((job) => ({
        id: job.id,
        jobType: job.jobType,
        status: job.status,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        metadata: job.metadata,
      }));

    const deltas = external
      ? {
          editors: localEditorsCount - Number(external.editorsCount),
          articles: localArticlesCount - Number(external.articlesCount),
          articlesCreated: localArticlesCreated - Number(external.articlesCreated),
          wordsAdded: Math.round(localCharacterSum / 6) - Number(external.wordsAdded),
          referencesAdded: localReferencesCount - Number(external.referencesAdded),
          pageviews: localPageviews - Number(external.pageviews),
          commonsUploads: localUploadsComparable - Number(external.commonsUploads),
        }
      : null;

    const staleHours = lastSyncJob?.completedAt
      ? Math.floor((Date.now() - new Date(lastSyncJob.completedAt).getTime()) / (1000 * 60 * 60))
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
          commonsUploads: localCommonsUploads,
          commonsUploadsComparable: localUploadsComparable,
        },
        external,
        deltas,
        lastSync: lastSyncJob
          ? {
              jobType: lastSyncJob.jobType,
              completedAt: lastSyncJob.completedAt,
              metadata: lastSyncJob.metadata,
            }
          : null,
        jobs: {
          active: activeJobs,
          latestByType,
        },
        sources: {
          localSyncStatusApi: "/api/stats/sync-status",
          outreachCourseApi: "/api/outreach/course?school=OKA&slug=OKA",
          outreachCoursePage: "https://outreachdashboard.wmflabs.org/courses/OKA/OKA/",
        },
        raw: {
          local: {
            editorsCount: localEditorsCount,
            articlesCount: localArticlesCount,
            articlesCreated: localArticlesCreated,
            wordsAdded: Math.round(localCharacterSum / 6),
            referencesAdded: localReferencesCount,
            pageviews: localPageviews,
            commonsUploads: localCommonsUploads,
          },
          external: externalRaw,
        },
        syncHealth: {
          staleHours,
          hasActiveJobs: activeJobs.length > 0,
          latestFailedJobs: latestByType
            .filter((job) => job.status === "failed")
            .map((job) => job.jobType),
        },
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

statsRoutes.get("/uploads-reconcile", async (c) => {
  try {
    const limitQuery = Number(c.req.query("limit") ?? 20);
    const limit = Number.isFinite(limitQuery) ? Math.min(Math.max(limitQuery, 1), 200) : 20;

    const [externalSnapshot, localEditors] = await Promise.all([
      getExternalSnapshot(),
      prisma.editor.findMany({
        where: { isActive: true },
        select: {
          username: true,
          _count: { select: { commonsUploads: true } },
        },
      }),
    ]);

    if (!externalSnapshot) {
      return c.json({
        success: false,
        error: "External snapshot unavailable",
      });
    }

    const externalByUser = new Map(
      externalSnapshot.participants.map((participant) => [
        participant.username,
        participant.totalUploads,
      ]),
    );

    const localRows = localEditors.map((editor) => ({
      username: editor.username,
      normalizedUsername: editor.username.toLowerCase(),
      localUploads: editor._count.commonsUploads,
      externalUploads: externalByUser.get(editor.username.toLowerCase()) ?? 0,
    }));

    const diffs = localRows
      .map((row) => ({
        username: row.username,
        localUploads: row.localUploads,
        externalUploads: row.externalUploads,
        diff: row.localUploads - row.externalUploads,
      }))
      .filter((row) => row.diff !== 0)
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    const localTotal = localRows.reduce((sum, row) => sum + row.localUploads, 0);
    const externalTotal = externalSnapshot.participants.reduce(
      (sum, participant) => sum + participant.totalUploads,
      0,
    );

    const localOnlyUsers = diffs.filter((row) => row.externalUploads === 0).length;
    const externalOnlyUsers = externalSnapshot.participants.filter(
      (participant) => !localRows.some((row) => row.normalizedUsername === participant.username),
    ).length;

    return c.json({
      success: true,
      data: {
        totals: {
          localUploads: localTotal,
          externalUploads: externalTotal,
          diff: localTotal - externalTotal,
        },
        population: {
          localEditors: localRows.length,
          externalParticipants: externalSnapshot.participants.length,
          localOnlyUsers,
          externalOnlyUsers,
        },
        topDiffs: diffs.slice(0, limit),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error reconciling uploads:", message);

    return c.json(
      {
        success: false,
        error: "Failed to reconcile uploads",
        details: message,
      },
      500,
    );
  }
});
