import { Hono } from "hono";
import { ZodError } from "zod";
import { prisma } from "@repo/db";
import { OutreachDashboardClient } from "@repo/utils/src/outreach-dashboard";
import { StatsService } from "../services";
import { SnapshotReportService } from "../services/snapshot-report.service";
import { ReportExportService } from "../services/report-export.service";
import {
  StatsFilterSchema,
  HistoryBackfillSchema,
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
const snapshotReportService = new SnapshotReportService(prisma);

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

const getExternalSnapshotWithTimeout = async (
  timeoutMs = 5000,
): Promise<ExternalSnapshot | null> => {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  return Promise.race([getExternalSnapshot().catch(() => null), timeout]);
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

statsRoutes.get("/annual/export", async (c) => {
  try {
    const parsed = ReportExportQuerySchema.parse(c.req.query());
    const { year, format, wikiProject } = parsed;

    const impact = !wikiProject ? await statsService.getImpactReport(year, 10, true) : null;
    const stats = impact ?? (await statsService.getAnnualStats(year, { wikiProject }));
    const topArticles =
      impact?.topArticles ?? (await statsService.getTopArticlesByYear(year, 10, wikiProject));

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
    if (error instanceof ZodError || (error instanceof Error && error.name === "ZodError"))
      return c.json({ success: false, error: "Invalid query parameters" }, 400);
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
    if (error instanceof ZodError || (error instanceof Error && error.name === "ZodError"))
      return c.json({ success: false, error: "Invalid query parameters" }, 400);
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

statsRoutes.get("/annual-impact", async (c) => {
  try {
    const year = Number(c.req.query("year") ?? new Date().getUTCFullYear() - 1);
    const limit = Math.min(50, Math.max(1, Number(c.req.query("limit") ?? 10)));
    const includeMonthly = c.req.query("includeMonthly") === "true";
    if (!Number.isInteger(year) || year < 2020 || year > 2100)
      return c.json({ success: false, error: "Invalid year" }, 400);
    return c.json({
      success: true,
      data: await statsService.getImpactReport(year, limit, includeMonthly),
    });
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
  const canonical =
    !parsed.wikiProject && !parsed.source
      ? await statsService.getImpactReport(year, 10, true)
      : null;
  const stats = canonical
    ? null
    : await statsService.getAnnualStats(year, {
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
    if (error instanceof ZodError || (error instanceof Error && error.name === "ZodError"))
      return c.json({ success: false, error: "Invalid query parameters" }, 400);
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
    if (error instanceof ZodError || (error instanceof Error && error.name === "ZodError"))
      return c.json({ success: false, error: "Invalid query parameters" }, 400);
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
        total: Math.max(
          0,
          Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1,
        ),
      } as any,
    },
  });

  return c.json(
    { success: true, data: { jobId: job.id, startDate, endDate, status: "pending" } },
    202,
  );
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

    const [canonicalLocal, localSums, localEditors, lastSyncJob, externalSnapshot, recentJobs] =
      await Promise.all([
        statsService.getCurrentDatasetStats(),
        prisma.article.aggregate({
          _sum: {
            characterSum: true,
            referencesCount: true,
          },
        }),
        prisma.editor.findMany({
          where: { isActive: true },
          select: { id: true, username: true },
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
      : canonicalLocal.commonsUploads;

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
          editors: canonicalLocal.editorsCount - Number(external.editorsCount),
          articles: canonicalLocal.totalArticles - Number(external.articlesCount),
          articlesCreated: canonicalLocal.articlesCreated - Number(external.articlesCreated),
          wordsAdded: canonicalLocal.wordsAdded - Number(external.wordsAdded),
          referencesAdded: localReferencesCount - Number(external.referencesAdded),
          pageviews: canonicalLocal.pageviews - Number(external.pageviews),
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
          editorsCount: canonicalLocal.editorsCount,
          articlesCount: canonicalLocal.totalArticles,
          articlesCreated: canonicalLocal.articlesCreated,
          characterSum: localCharacterSum,
          wordsAdded: canonicalLocal.wordsAdded,
          referencesAdded: localReferencesCount,
          pageviews: canonicalLocal.pageviews,
          commonsUploads: canonicalLocal.commonsUploads,
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
            editorsCount: canonicalLocal.editorsCount,
            articlesCount: canonicalLocal.totalArticles,
            articlesCreated: canonicalLocal.articlesCreated,
            wordsAdded: canonicalLocal.wordsAdded,
            referencesAdded: localReferencesCount,
            pageviews: canonicalLocal.pageviews,
            commonsUploads: canonicalLocal.commonsUploads,
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
          (canonicalLocal.editorsCount === 0 ||
            canonicalLocal.totalArticles === 0 ||
            canonicalLocal.editorsCount < external.editorsCount ||
            canonicalLocal.totalArticles < external.articlesCount),
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

// --- Snapshot-based report endpoints (daily-first layered rollups) ---

// GET /api/stats/snapshot/report?granularity=MONTH&start=2026-01-01&end=2026-12-31&wikiProject=
statsRoutes.get("/snapshot/report", async (c) => {
  const granularity = (c.req.query("granularity") ?? "MONTH").toUpperCase();
  if (!["DAY", "MONTH", "YEAR"].includes(granularity)) {
    return c.json({ success: false, error: "granularity must be DAY|MONTH|YEAR" }, 400);
  }
  const start = new Date(c.req.query("start") ?? new Date(Date.UTC(2022, 4, 1)).toISOString());
  const end = new Date(c.req.query("end") ?? new Date().toISOString());
  const wikiProject = c.req.query("wikiProject") || undefined;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return c.json({ success: false, error: "invalid start/end" }, 400);
  }
  try {
    const report = await snapshotReportService.report(granularity as "DAY" | "MONTH" | "YEAR", start, end, wikiProject);
    return c.json({ success: true, data: report });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ success: false, error: message }, 500);
  }
});

// GET /api/stats/snapshot/articles?granularity=MONTH&start=&end=
statsRoutes.get("/snapshot/articles", async (c) => {
  const granularity = (c.req.query("granularity") ?? "DAY").toUpperCase();
  const start = new Date(c.req.query("start") ?? new Date(Date.UTC(2022, 4, 1)).toISOString());
  const end = new Date(c.req.query("end") ?? new Date().toISOString());
  const wikiProject = c.req.query("wikiProject") || undefined;
  if (!["DAY", "MONTH", "YEAR"].includes(granularity) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return c.json({ success: false, error: "invalid params" }, 400);
  }
  try {
    const rows = await snapshotReportService.articleDetails(granularity as "DAY" | "MONTH" | "YEAR", start, end, wikiProject);
    return c.json({ success: true, data: rows });
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// GET /api/stats/snapshot/editors?granularity=MONTH&start=&end=
statsRoutes.get("/snapshot/editors", async (c) => {
  const granularity = (c.req.query("granularity") ?? "DAY").toUpperCase();
  const start = new Date(c.req.query("start") ?? new Date(Date.UTC(2022, 4, 1)).toISOString());
  const end = new Date(c.req.query("end") ?? new Date().toISOString());
  if (!["DAY", "MONTH", "YEAR"].includes(granularity) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return c.json({ success: false, error: "invalid params" }, 400);
  }
  try {
    const rows = await snapshotReportService.editorDetails(granularity as "DAY" | "MONTH" | "YEAR", start, end);
    return c.json({ success: true, data: rows });
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// GET /api/stats/snapshot/daily?start=&end=
statsRoutes.get("/snapshot/daily", async (c) => {
  const start = new Date(c.req.query("start") ?? new Date(Date.UTC(2022, 4, 1)).toISOString());
  const end = new Date(c.req.query("end") ?? new Date().toISOString());
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return c.json({ success: false, error: "invalid params" }, 400);
  }
  try {
    const rows = await snapshotReportService.dailyHistory(start, end);
    return c.json({ success: true, data: rows });
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
