import type { PrismaClient } from "@repo/db/generated/prisma/client";
import type { Granularity } from "@repo/db/generated/prisma/client";

interface BuildResult {
  granularity: Granularity;
  months: number;
  years: number;
  rows: number;
}

/**
 * Builds pre-aggregated MetricSnapshot rows (MONTH/YEAR) from the raw tables.
 *
 * Semantics (mirror stats.service aggregation):
 * - Contributions are scoped to program-eligible editors (enrolledAt filter).
 * - Pageviews: historical monthly rows win; DAILY rows fall back per article.
 * - Rollups are idempotent: each (granularity, periodStart, programId,
 *   wikiProject) is a single row, upserted.
 */
export class SnapshotService {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /** Map editorId -> earliest enrollment across active programs. */
  private async getEnrolledAtByEditor(): Promise<Map<string, Date>> {
    const members = await this.prisma.programMember.findMany({
      where: { isActive: true },
      select: { editorId: true, enrolledAt: true },
    });
    const map = new Map<string, Date>();
    for (const member of members) {
      const current = map.get(member.editorId);
      if (!current || member.enrolledAt < current) map.set(member.editorId, member.enrolledAt);
    }
    return map;
  }

  /** Build snapshots for every month/year in [start, end] (UTC, inclusive). */
  async build(start: Date, end: Date): Promise<BuildResult> {
    const program = await this.prisma.program.findFirst({ where: { slug: "OKA" } });
    const programId = program?.id ?? null;

    const enrolledAtByEditor = await this.getEnrolledAtByEditor();
    const eligibleEditorIds = Array.from(enrolledAtByEditor.keys());

    // Walk months from start to end (inclusive).
    const cursorStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    let cursor = cursorStart;
    let months = 0;
    let years = 0;
    let rows = 0;

    while (cursor <= last) {
      const year = cursor.getUTCFullYear();
      const month = cursor.getUTCMonth();
      const monthStart = new Date(Date.UTC(year, month, 1));
      const monthEnd = new Date(Date.UTC(year, month + 1, 1));

      // --- contributions in this month (scoped to eligible editors) ---
      const contributions = await this.prisma.contribution.findMany({
        where: { editTimestamp: { gte: monthStart, lt: monthEnd } },
        select: { articleId: true, editorId: true, wordsAdded: true, editTimestamp: true },
      });
      const eligible = contributions.filter((row) => {
        const enrolledAt = enrolledAtByEditor.get(row.editorId);
        return !enrolledAt || row.editTimestamp >= enrolledAt;
      });
      const editors = new Set(eligible.map((row) => row.editorId));
      const editedArticles = new Set(eligible.map((row) => row.articleId));
      const createdArticles = new Set(
        (
          await this.prisma.contribution.findMany({
            where: { editTimestamp: { gte: monthStart, lt: monthEnd }, isCreation: true },
            select: { articleId: true },
          })
        )
          .map((row) => row.articleId)
          .filter((articleId) => eligible.some((row) => row.articleId === articleId)),
      );

      // --- pageviews for this month (historical first, daily fallback) ---
      const [historicalViews, dailyViews, commonsUploads] = await Promise.all([
        this.prisma.historicalPageview.groupBy({
          by: ["articleId"],
          where: { periodStart: { gte: monthStart, lt: monthEnd }, status: "SUCCESS" },
          _sum: { views: true },
        }),
        this.prisma.pageview.groupBy({
          by: ["articleId"],
          where: { date: { gte: monthStart, lt: monthEnd }, type: "DAILY", agentType: "ALL_AGENTS" },
          _sum: { views: true },
        }),
        this.prisma.commonsUpload.count({ where: { uploadedAt: { gte: monthStart, lt: monthEnd } } }),
      ]);
      const historicalByArticle = new Map(
        historicalViews.map((row) => [row.articleId, row._sum.views ?? 0]),
      );
      const dailyByArticle = new Map(dailyViews.map((row) => [row.articleId, row._sum.views ?? 0]));
      let pageviewTotal = 0;
      for (const articleId of new Set([...historicalByArticle.keys(), ...dailyByArticle.keys()])) {
        pageviewTotal += historicalByArticle.has(articleId)
          ? historicalByArticle.get(articleId)!
          : dailyByArticle.get(articleId)!;
      }

      const wordsAdded = eligible.reduce((sum, row) => sum + row.wordsAdded, 0);
      await this.prisma.metricSnapshot.upsert({
        where: {
          granularity_periodStart_programId_wikiProject: {
            granularity: "MONTH",
            periodStart: monthStart,
            programId: programId!,
            wikiProject: "",
          },
        },
        create: {
          granularity: "MONTH",
          periodStart: monthStart,
          periodEnd: new Date(monthEnd.getTime() - 1),
          programId,
          wikiProject: "",
          edits: eligible.length,
          wordsAdded,
          pageviews: pageviewTotal,
          articlesCreated: createdArticles.size,
          articlesEdited: editedArticles.size,
          editors: editors.size,
          commonsUploads,
        },
        update: {
          periodEnd: new Date(monthEnd.getTime() - 1),
          edits: eligible.length,
          wordsAdded,
          pageviews: pageviewTotal,
          articlesCreated: createdArticles.size,
          articlesEdited: editedArticles.size,
          editors: editors.size,
          commonsUploads,
          updatedAt: new Date(),
        },
      });
      rows += 1;
      months += 1;

      cursor = new Date(Date.UTC(year, month + 1, 1));
    }

    // --- YEAR rows (roll up from the monthly snapshot rows) ---
    const yearStart = new Date(Date.UTC(start.getUTCFullYear(), 0, 1));
    const yearEnd = new Date(Date.UTC(end.getUTCFullYear() + 1, 0, 1));
    const monthRows = await this.prisma.metricSnapshot.findMany({
      where: {
        granularity: "MONTH",
        periodStart: { gte: yearStart, lt: yearEnd },
        programId,
      },
    });
    const byYear = new Map<number, {
      edits: number; wordsAdded: number; pageviews: number;
      articlesCreated: number; articlesEdited: number; editors: number; commonsUploads: number;
    }>();
    for (const row of monthRows) {
      const y = row.periodStart.getUTCFullYear();
      const acc = byYear.get(y) ?? {
        edits: 0, wordsAdded: 0, pageviews: 0,
        articlesCreated: 0, articlesEdited: 0, editors: 0, commonsUploads: 0,
      };
      acc.edits += row.edits;
      acc.wordsAdded += row.wordsAdded;
      acc.pageviews += row.pageviews;
      acc.articlesCreated += row.articlesCreated;
      acc.articlesEdited += row.articlesEdited;
      acc.editors = Math.max(acc.editors, row.editors);
      acc.commonsUploads += row.commonsUploads;
      byYear.set(y, acc);
    }
    for (const [y, acc] of byYear) {
      await this.prisma.metricSnapshot.upsert({
        where: {
          granularity_periodStart_programId_wikiProject: {
            granularity: "YEAR",
            periodStart: new Date(Date.UTC(y, 0, 1)),
            programId: programId!,
            wikiProject: "",
          },
        },
        create: {
          granularity: "YEAR",
          periodStart: new Date(Date.UTC(y, 0, 1)),
          periodEnd: new Date(Date.UTC(y + 1, 0, 1) - 1),
          programId,
          wikiProject: "",
          edits: acc.edits,
          wordsAdded: acc.wordsAdded,
          pageviews: acc.pageviews,
          articlesCreated: acc.articlesCreated,
          articlesEdited: acc.articlesEdited,
          editors: acc.editors,
          commonsUploads: acc.commonsUploads,
        },
        update: {
          periodEnd: new Date(Date.UTC(y + 1, 0, 1) - 1),
          edits: acc.edits,
          wordsAdded: acc.wordsAdded,
          pageviews: acc.pageviews,
          articlesCreated: acc.articlesCreated,
          articlesEdited: acc.articlesEdited,
          editors: acc.editors,
          commonsUploads: acc.commonsUploads,
          updatedAt: new Date(),
        },
      });
      rows += 1;
      years += 1;
    }

    return { granularity: "MONTH", months, years, rows };
  }
}
