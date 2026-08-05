import type { PrismaClient, Prisma, Granularity } from "@repo/db/generated/prisma/client";

export interface SnapshotTotals {
  edits: number;
  wordsAdded: number;
  articlesCreated: number;
  articlesEdited: number;
  editors: number;
  refsAdded: number;
  viewsTotal: number;
  viewsActive: number;
  commonsUploads: number;
}

export interface PeriodPoint extends SnapshotTotals {
  periodStart: string; // ISO date of period start
  periodEnd: string;
}

export interface SnapshotReport {
  granularity: Granularity;
  periodStart: string;
  periodEnd: string;
  totals: SnapshotTotals;
  byPeriod: PeriodPoint[]; // days for DAY, months for MONTH, years for YEAR
  topArticles: Array<{ articleId: string; title: string; wikiProject: string; edits: number; viewsTotal: number }>;
}

const EMPTY: SnapshotTotals = {
  edits: 0, wordsAdded: 0, articlesCreated: 0, articlesEdited: 0,
  editors: 0, refsAdded: 0, viewsTotal: 0, viewsActive: 0, commonsUploads: 0,
};

/**
 * Snapshot-based report service. All reports read only `metric_snapshots`
 * (pre-aggregated by SnapshotService) — nothing is aggregated on the fly.
 * `period_article_activity` / `period_editor_activity` power the detail
 * endpoints (which articles/editors, what they did).
 */
export class SnapshotReportService {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  private async getProgramId(): Promise<string> {
    const program = await this.prisma.program.findFirst({ where: { slug: "OKA" } });
    if (!program) throw new Error("OKA program not found");
    return program.id;
  }

  private rowToTotals(row: {
    edits: number; wordsAdded: number; articlesCreated: number; articlesEdited: number;
    editors: number; refsAdded: number; viewsTotal: number; viewsActive: number; commonsUploads: number;
  }): SnapshotTotals {
    return {
      edits: row.edits,
      wordsAdded: row.wordsAdded,
      articlesCreated: row.articlesCreated,
      articlesEdited: row.articlesEdited,
      editors: row.editors,
      refsAdded: row.refsAdded,
      viewsTotal: row.viewsTotal,
      viewsActive: row.viewsActive,
      commonsUploads: row.commonsUploads,
    };
  }

  /**
   * Report for a range at a granularity, scoped to the program (optionally a
   * single wikiProject). Returns totals + per-period breakdown.
   */
  async report(
    granularity: Granularity,
    start: Date,
    end: Date,
    wikiProject?: string,
  ): Promise<SnapshotReport> {
    const programId = await this.getProgramId();
    const where = {
      granularity,
      programId,
      wikiProject: wikiProject ?? "",
      periodStart: { gte: start, lt: end },
      agentType: "ALL_AGENTS",
    };

    const rows = await this.prisma.metricSnapshot.findMany({
      where,
      orderBy: { periodStart: "asc" },
    });

    const totals: SnapshotTotals = { ...EMPTY };
    const byPeriod: PeriodPoint[] = [];
    for (const row of rows) {
      const t = this.rowToTotals(row);
      totals.edits += t.edits;
      totals.wordsAdded += t.wordsAdded;
      totals.articlesCreated += t.articlesCreated;
      totals.articlesEdited += t.articlesEdited;
      totals.editors = Math.max(totals.editors, t.editors); // distinct-ish (max)
      totals.refsAdded += t.refsAdded;
      totals.viewsTotal += t.viewsTotal;
      totals.viewsActive += t.viewsActive;
      totals.commonsUploads += t.commonsUploads;
      byPeriod.push({
        ...t,
        periodStart: row.periodStart.toISOString().slice(0, 10),
        periodEnd: row.periodEnd.toISOString().slice(0, 10),
      });
    }

    const topArticles = await this.getTopArticles(granularity, start, end, wikiProject, 10);

    return {
      granularity,
      periodStart: start.toISOString().slice(0, 10),
      periodEnd: end.toISOString().slice(0, 10),
      totals,
      byPeriod,
      topArticles,
    };
  }

  /** Top articles by edits within a range (from period_article_activity DAY rows). */
  private async getTopArticles(
    granularity: Granularity,
    start: Date,
    end: Date,
    wikiProject: string | undefined,
    limit: number,
  ): Promise<SnapshotReport["topArticles"]> {
    void granularity; // aggregation over DAY rows covers all granularities
    const programId = await this.getProgramId();
    const rows = await this.prisma.periodArticleActivity.findMany({
      where: {
        granularity: "DAY",
        programId,
        wikiProject: wikiProject ?? "",
        periodStart: { gte: start, lt: end },
      },
      select: {
        articleId: true,
        edits: true,
        viewsTotal: true,
        article: { select: { title: true, wikiProject: true } },
      },
    });
    const agg = new Map<string, { title: string; wikiProject: string; edits: number; viewsTotal: number }>();
    for (const r of rows) {
      const a = agg.get(r.articleId) ?? {
        title: r.article.title, wikiProject: r.article.wikiProject, edits: 0, viewsTotal: 0,
      };
      a.edits += r.edits;
      a.viewsTotal += r.viewsTotal;
      agg.set(r.articleId, a);
    }
    return [...agg.entries()]
      .sort(([, x], [, y]) => y.edits - x.edits)
      .slice(0, limit)
      .map(([articleId, a]) => ({
        articleId,
        title: a.title,
        wikiProject: a.wikiProject,
        edits: a.edits,
        viewsTotal: a.viewsTotal,
      }));
  }

  /** Detail: per-article activity in a period (created/edited articles). */
  async articleDetails(
    granularity: Granularity,
    start: Date,
    end: Date,
    wikiProject?: string,
  ): Promise<Array<{
    articleId: string; title: string; wikiProject: string;
    edits: number; wordsAdded: number; isCreated: boolean;
    viewsTotal: number; viewsActive: number; refsAdded: number;
  }>> {
    const programId = await this.getProgramId();
    // Aggregate DAY detail rows over the range (works for any granularity).
    const rows = await this.prisma.periodArticleActivity.findMany({
      where: {
        granularity: "DAY",
        programId,
        wikiProject: wikiProject ?? "",
        periodStart: { gte: start, lt: end },
      },
      select: {
        articleId: true, edits: true, wordsAdded: true, isCreated: true,
        viewsTotal: true, viewsActive: true, refsAdded: true,
        article: { select: { title: true, wikiProject: true } },
      },
    });
    // Aggregate in JS (bounded: max 500 articles by edits desc).
    const agg = new Map<string, {
      title: string; wikiProject: string; edits: number; wordsAdded: number;
      created: boolean; viewsTotal: number; viewsActive: number; refsAdded: number;
    }>();
    for (const r of rows) {
      let a = agg.get(r.articleId);
      if (!a) {
        a = {
          title: r.article.title, wikiProject: r.article.wikiProject,
          edits: 0, wordsAdded: 0, created: false, viewsTotal: 0, viewsActive: 0, refsAdded: 0,
        };
        agg.set(r.articleId, a);
      }
      a.edits += r.edits;
      a.wordsAdded += r.wordsAdded;
      if (r.isCreated) a.created = true;
      a.viewsTotal += r.viewsTotal;
      a.viewsActive += r.viewsActive;
      a.refsAdded += r.refsAdded;
    }
    return [...agg.entries()]
      .sort(([, x], [, y]) => y.edits - x.edits)
      .slice(0, 500)
      .map(([articleId, a]) => ({
        articleId,
        title: a.title,
        wikiProject: a.wikiProject,
        edits: a.edits,
        wordsAdded: a.wordsAdded,
        isCreated: a.created,
        viewsTotal: a.viewsTotal,
        viewsActive: a.viewsActive,
        refsAdded: a.refsAdded,
      }));
  }

  /** Detail: per-editor activity. Returns ALL program editors (0-activity included),
   *  aggregated over lifetime activity since enrollment, plus a hasActivity flag.
   *  If start/end provided, restricts the aggregated window. */
  async editorDetails(
    granularity: Granularity,
    start?: Date,
    end?: Date,
  ): Promise<Array<{
    editorId: string; username: string;
    edits: number; wordsAdded: number; articlesCreated: number;
    articlesEdited: number; commonsUploads: number;
    hasActivity: boolean;
  }>> {
    const programId = await this.getProgramId();

    // All program members (including inactive ones if isActive=false excluded? keep active)
    const members = await this.prisma.programMember.findMany({
      where: { programId, isActive: true },
      select: {
        editorId: true,
        editor: { select: { username: true } },
      },
      orderBy: { enrolledAt: "asc" },
    });

    // Aggregate lifetime activity per editor from DAY detail rows,
    // optionally windowed by start/end.
    const activityWhere: Prisma.PeriodEditorActivityWhereInput = {
      granularity: "DAY",
      programId,
      editorId: { in: members.map((m) => m.editorId) },
    };
    if (start || end) {
      activityWhere.periodStart = {
        ...(start ? { gte: start } : {}),
        ...(end ? { lt: end } : {}),
      };
    }
    const rows = await this.prisma.periodEditorActivity.findMany({
      where: activityWhere,
      select: {
        editorId: true, edits: true, wordsAdded: true,
        articlesCreated: true, articlesEdited: true, commonsUploads: true,
      },
    });

    const agg = new Map<string, {
      edits: number; wordsAdded: number;
      articlesCreated: number; articlesEdited: number; commonsUploads: number;
    }>();
    for (const r of rows) {
      let e = agg.get(r.editorId);
      if (!e) {
        e = { edits: 0, wordsAdded: 0, articlesCreated: 0, articlesEdited: 0, commonsUploads: 0 };
        agg.set(r.editorId, e);
      }
      e.edits += r.edits;
      e.wordsAdded += r.wordsAdded;
      e.articlesCreated += r.articlesCreated;
      e.articlesEdited += r.articlesEdited;
      e.commonsUploads += r.commonsUploads;
    }

    return members.map((m) => {
      const a = agg.get(m.editorId);
      return {
        editorId: m.editorId,
        username: m.editor.username,
        edits: a?.edits ?? 0,
        wordsAdded: a?.wordsAdded ?? 0,
        articlesCreated: a?.articlesCreated ?? 0,
        articlesEdited: a?.articlesEdited ?? 0,
        commonsUploads: a?.commonsUploads ?? 0,
        hasActivity: a !== undefined,
      };
    }).sort((x, y) => y.edits - x.edits);
  }

  /** Daily history (for charts) — DAY snapshots in range. */
  async dailyHistory(start: Date, end: Date): Promise<PeriodPoint[]> {
    const programId = await this.getProgramId();
    const rows = await this.prisma.metricSnapshot.findMany({
      where: {
        granularity: "DAY",
        programId,
        wikiProject: "",
        periodStart: { gte: start, lt: end },
        agentType: "ALL_AGENTS",
      },
      orderBy: { periodStart: "asc" },
    });
    return rows.map((row) => ({
      ...this.rowToTotals(row),
      periodStart: row.periodStart.toISOString().slice(0, 10),
      periodEnd: row.periodEnd.toISOString().slice(0, 10),
    }));
  }
}
