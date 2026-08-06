import type {
  ArticleSource,
  PageviewType,
  Prisma,
  PrismaClient,
} from "@repo/db/generated/prisma/client";

export type StatsFilter = {
  startDate?: Date;
  endDate?: Date;
  wikiProject?: string;
  editorId?: string;
  source?: ArticleSource;
};

export type OverallStats = {
  edits: number;
  wordsAdded: number;
  pageviews: number;
  articlesCreated: number;
  articlesModified: number;
  commonsUploads: number;
};

export type CurrentDatasetStats = {
  editorsCount: number;
  articlesCreated: number;
  articlesEdited: number;
  totalArticles: number;
  totalEdits: number;
  wordsAdded: number;
  referencesAdded: number;
  pageviews: number;
  commonsUploads: number;
};

export type WikiProjectStats = OverallStats & {
  wikiProject: string;
};

export type EditorStats = OverallStats & {
  editorId: string;
  username: string;
};


export type AnnualStats = {
  edits: number;
  wordsAdded: number;
  pageviews: number;
  articlesCreated: number;
  articlesEdited: number;
  editors: number;
  referencesAdded: number;
  commonsUploads: number;
};

export type WikiProjectAnnualStats = AnnualStats & {
  wikiProject: string;
};

export type PeriodPerformancePoint = {
  period: string;
  edits: number;
  wordsAdded: number;
  pageviews: number;
  articlesCreated: number;
  articlesEdited: number;
  editors: number;
  referencesAdded: number;
  commonsUploads: number;
};

export type YoYComparison = {
  [key: string]: { current: number; previous: number; changePercent: number };
} & {
  edits?: { current: number; previous: number; changePercent: number };
  wordsAdded?: { current: number; previous: number; changePercent: number };
  pageviews?: { current: number; previous: number; changePercent: number };
  articlesCreated?: { current: number; previous: number; changePercent: number };
  articlesEdited?: { current: number; previous: number; changePercent: number };
  editors?: { current: number; previous: number; changePercent: number };
  referencesAdded?: { current: number; previous: number; changePercent: number };
  commonsUploads?: { current: number; previous: number; changePercent: number };
};

export type TopArticle = {
  rank: number;
  title: string;
  wikiProject: string;
  totalPageviews: number;
  articleId: string;
};

type Granularity = "daily" | "weekly" | "monthly";

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const toUtcDate = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const addUtcDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const startOfWeekUtc = (date: Date) => {
  const day = date.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  result.setUTCDate(result.getUTCDate() + diff);
  return result;
};


export class StatsService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Editor IDs that are (or were) enrolled in any active program.
   * Used to scope contribution aggregation to program attribution.
   */
  private async getProgramEligibleEditorIds(): Promise<string[]> {
    const members = await this.prisma.programMember.findMany({
      where: { isActive: true },
      select: { editorId: true },
    });
    return Array.from(new Set(members.map((m) => m.editorId)));
  }

  /**
   * Map editorId -> earliest enrollment across active programs.
   * Contributions before this timestamp are excluded from program metrics.
   */
  private async getEnrolledAtByEditorMap(): Promise<Map<string, Date>> {
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

  /**
   * Queue a snapshot_build sync job (replaces legacy daily-stats backfill).
   */
  async queueSnapshotBuild() {
    return this.prisma.syncJob.create({
      data: {
        jobType: "snapshot_build",
        status: "pending",
        metadata: {
          startDate: "2026-01-01T00:00:00.000Z",
          endDate: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Canonical lifetime totals used by the dashboard and article catalogue.
   * Period reports use the same contribution semantics, constrained by date.
   */
  async getCurrentDatasetStats(): Promise<CurrentDatasetStats> {
    const [editorsCount, articles, contributions, commonsUploads, articleSums, eligibleEditorIds] =
      await Promise.all([
        this.prisma.editor.count({ where: { isActive: true } }),
        this.prisma.article.findMany({ select: { id: true, source: true } }),
        this.prisma.contribution.findMany({
          select: { articleId: true, editorId: true, isCreation: true, wordsAdded: true },
        }),
        this.prisma.commonsUpload.count(),
        this.prisma.article.aggregate({ _sum: { referencesCount: true } }),
        this.getProgramEligibleEditorIds(),
      ]);

    const eligibleSet = new Set(eligibleEditorIds);
    // Only contributions from editors enrolled in the program count.
    const eligibleContributions = contributions.filter((row) => eligibleSet.has(row.editorId));

    const createdArticleIds = new Set(
      eligibleContributions.filter((row) => row.isCreation).map((row) => row.articleId),
    );
    const editedArticleIds = new Set(eligibleContributions.map((row) => row.articleId));

    return {
      editorsCount,
      articlesCreated: createdArticleIds.size,
      articlesEdited: editedArticleIds.size,
      totalArticles: articles.length,
      totalEdits: eligibleContributions.length,
      wordsAdded: eligibleContributions.reduce((sum, row) => sum + row.wordsAdded, 0),
      referencesAdded: articleSums._sum.referencesCount ?? 0,
      pageviews: await this.getCurrentPageviewsForArticles(articles),
      commonsUploads,
    };
  }

  async getCurrentArticleStats(filters: { source?: ArticleSource; wikiProject?: string } = {}) {
    const articles = await this.prisma.article.findMany({
      where: {
        ...(filters.source ? { source: filters.source } : {}),
        ...(filters.wikiProject ? { wikiProject: filters.wikiProject } : {}),
      },
      select: { id: true, wikiProject: true, source: true },
    });
    const pageviewsByArticle = await this.getCurrentPageviewsForArticles(articles, true);
    const wikiPageviews = new Map<string, number>();
    for (const article of articles) {
      const views = pageviewsByArticle.get(article.id) ?? 0;
      wikiPageviews.set(article.wikiProject, (wikiPageviews.get(article.wikiProject) ?? 0) + views);
    }
    return { articles, pageviewsByArticle, wikiPageviews };
  }

  async getCurrentPageviewsForArticles(
    articles: Array<{ id: string; source: ArticleSource }>,
  ): Promise<number>;
  async getCurrentPageviewsForArticles(
    articles: Array<{ id: string; source: ArticleSource }>,
    asMap: true,
  ): Promise<Map<string, number>>;
  async getCurrentPageviewsForArticles(
    articles: Array<{ id: string; source: ArticleSource }>,
    asMap = false,
  ): Promise<number | Map<string, number>> {
    if (articles.length === 0) return asMap ? new Map() : 0;
    const ids = articles.map((article) => article.id);
    // A huge IN (...) list (whole-dataset lifetime totals) exceeds the
    // PostgreSQL parameter limit (P2029). For full-dataset calls, aggregate
    // over all rows instead of filtering by article id.
    const fullDataset = articles.length > 10000;
    const [daily, cumulative] = await Promise.all([
      fullDataset
        ? this.prisma.pageview.groupBy({
            by: ["articleId"],
            where: { type: "DAILY", agentType: "ALL_AGENTS" },
            _sum: { views: true },
          })
        : this.prisma.pageview.groupBy({
            by: ["articleId"],
            where: { articleId: { in: ids }, type: "DAILY", agentType: "ALL_AGENTS" },
            _sum: { views: true },
          }),
      fullDataset
        ? this.prisma.pageview.findMany({
            where: { type: "CUMULATIVE", agentType: "ALL_AGENTS" },
            select: { articleId: true, views: true, cumulativeViews: true },
            orderBy: [{ articleId: "asc" }, { date: "desc" }],
            distinct: ["articleId"],
          })
        : this.prisma.pageview.findMany({
            where: { articleId: { in: ids }, type: "CUMULATIVE", agentType: "ALL_AGENTS" },
            select: { articleId: true, views: true, cumulativeViews: true },
            orderBy: [{ articleId: "asc" }, { date: "desc" }],
            distinct: ["articleId"],
          }),
    ]);
    const dailyByArticle = new Map(daily.map((row) => [row.articleId, row._sum.views ?? 0]));
    const cumulativeByArticle = new Map(
      cumulative.map((row) => [row.articleId, row.cumulativeViews ?? row.views]),
    );
    const totals = new Map<string, number>();
    for (const article of articles) {
      const value =
        article.source === "OUTREACH_DASHBOARD"
          ? (cumulativeByArticle.get(article.id) ?? dailyByArticle.get(article.id) ?? 0)
          : (dailyByArticle.get(article.id) ?? cumulativeByArticle.get(article.id) ?? 0);
      totals.set(article.id, value);
    }
    return asMap ? totals : Array.from(totals.values()).reduce((sum, value) => sum + value, 0);
  }

  async getOverallStats(filters: StatsFilter = {}): Promise<OverallStats> {
    const contributionWhere = this.buildContributionWhere(filters);
    const contributions = await this.prisma.contribution.findMany({
      where: contributionWhere,
      select: { wordsAdded: true, articleId: true, isCreation: true },
    });

    const edits = contributions.length;
    const wordsAdded = contributions.reduce((total, item) => total + item.wordsAdded, 0);

    const [articlesCreated, articlesModified, pageviews, commonsUploads] = await Promise.all([
      this.prisma.article.count({ where: this.buildCreatedArticleWhere(filters) }),
      this.prisma.article.count({ where: this.buildModifiedArticleWhere(filters) }),
      this.getTotalPageviews(filters),
      this.prisma.commonsUpload.count({ where: this.buildCommonsWhere(filters) }),
    ]);

    return {
      edits,
      wordsAdded,
      pageviews,
      articlesCreated,
      articlesModified,
      commonsUploads,
    };
  }

  async getStatsByWikiProject(filters: StatsFilter = {}): Promise<WikiProjectStats[]> {
    const contributionWhere = this.buildContributionWhere(filters);
    const contributions = await this.prisma.contribution.findMany({
      where: contributionWhere,
      select: {
        wordsAdded: true,
        isCreation: true,
        articleId: true,
        article: { select: { wikiProject: true } },
      },
    });

    const projectMap = new Map<string, WikiProjectStats>();

    const ensureProject = (project: string) => {
      if (!projectMap.has(project)) {
        projectMap.set(project, {
          wikiProject: project,
          edits: 0,
          wordsAdded: 0,
          pageviews: 0,
          articlesCreated: 0,
          articlesModified: 0,
          commonsUploads: 0,
        });
      }
      return projectMap.get(project)!;
    };

    for (const contribution of contributions) {
      const project = contribution.article.wikiProject;
      const stats = ensureProject(project);
      stats.edits += 1;
      stats.wordsAdded += contribution.wordsAdded;
    }

    const pageviewTotals = await this.getPageviewsByWikiProject(filters);
    for (const [project, total] of pageviewTotals.entries()) {
      const stats = ensureProject(project);
      stats.pageviews = total;
    }

    const [createdCounts, modifiedCounts] = await Promise.all([
      this.prisma.article.groupBy({
        by: ["wikiProject"],
        where: this.buildCreatedArticleWhere(filters),
        _count: { _all: true },
      }),
      this.prisma.article.groupBy({
        by: ["wikiProject"],
        where: this.buildModifiedArticleWhere(filters),
        _count: { _all: true },
      }),
    ]);

    for (const entry of createdCounts) {
      const stats = ensureProject(entry.wikiProject);
      stats.articlesCreated = entry._count._all;
    }

    for (const entry of modifiedCounts) {
      const stats = ensureProject(entry.wikiProject);
      stats.articlesModified = entry._count._all;
    }

    return Array.from(projectMap.values()).sort((a, b) => b.wordsAdded - a.wordsAdded);
  }

  async getStatsByEditor(filters: StatsFilter = {}): Promise<EditorStats[]> {
    const contributionWhere = this.buildContributionWhere(filters);
    const contributions = await this.prisma.contribution.findMany({
      where: contributionWhere,
      select: {
        wordsAdded: true,
        isCreation: true,
        articleId: true,
        editorId: true,
        editor: { select: { username: true } },
      },
    });

    const editorMap = new Map<string, EditorStats>();
    const createdByEditor = new Map<string, Set<string>>();
    const modifiedByEditor = new Map<string, Set<string>>();

    for (const contribution of contributions) {
      if (!editorMap.has(contribution.editorId)) {
        editorMap.set(contribution.editorId, {
          editorId: contribution.editorId,
          username: contribution.editor.username,
          edits: 0,
          wordsAdded: 0,
          pageviews: 0,
          articlesCreated: 0,
          articlesModified: 0,
          commonsUploads: 0,
        });
        createdByEditor.set(contribution.editorId, new Set());
        modifiedByEditor.set(contribution.editorId, new Set());
      }

      const stats = editorMap.get(contribution.editorId);
      if (!stats) continue;
      stats.edits += 1;
      stats.wordsAdded += contribution.wordsAdded;
      modifiedByEditor.get(contribution.editorId)?.add(contribution.articleId);
      if (contribution.isCreation) {
        createdByEditor.get(contribution.editorId)?.add(contribution.articleId);
      }
    }

    const pageviewTypes = this.resolvePageviewTypes(filters);

    if (pageviewTypes.includes("DAILY")) {
      const pageviews = await this.prisma.pageview.findMany({
        where: this.buildPageviewWhere(filters, "DAILY"),
        select: { views: true, article: { select: { createdByEditorId: true } } },
      });

      for (const pageview of pageviews) {
        const editorId = pageview.article.createdByEditorId;
        if (!editorId) continue;
        const stats = editorMap.get(editorId);
        if (stats) {
          stats.pageviews += pageview.views;
        }
      }
    }

    if (pageviewTypes.includes("CUMULATIVE")) {
      const snapshots = await this.getLatestCumulativePageviews(filters);
      for (const snapshot of snapshots) {
        const editorId = snapshot.article.createdByEditorId;
        if (!editorId) continue;
        const stats = editorMap.get(editorId);
        if (stats) {
          stats.pageviews += snapshot.cumulativeViews ?? snapshot.views ?? 0;
        }
      }
    }

    const uploads = await this.prisma.commonsUpload.findMany({
      where: this.buildCommonsWhere(filters),
      select: { editorId: true },
    });

    for (const upload of uploads) {
      const stats = editorMap.get(upload.editorId);
      if (stats) {
        stats.commonsUploads += 1;
      }
    }

    for (const [editorId, stats] of editorMap.entries()) {
      stats.articlesCreated = createdByEditor.get(editorId)?.size ?? 0;
      stats.articlesModified = modifiedByEditor.get(editorId)?.size ?? 0;
    }

    return Array.from(editorMap.values()).sort((a, b) => b.wordsAdded - a.wordsAdded);
  }

  private resolvePageviewTypes(filters: StatsFilter): PageviewType[] {
    if (filters.source === "MEDIAWIKI") {
      return ["DAILY"];
    }

    if (filters.source === "OUTREACH_DASHBOARD") {
      return ["DAILY"];
    }

    return ["DAILY"];
  }


  private buildContributionFilter(filters: StatsFilter): Prisma.ContributionWhereInput {
    const where: Prisma.ContributionWhereInput = {};
    if (filters.editorId) {
      where.editorId = filters.editorId;
    }
    if (filters.startDate || filters.endDate) {
      where.editTimestamp = {
        ...(filters.startDate ? { gte: filters.startDate } : {}),
        ...(filters.endDate ? { lte: filters.endDate } : {}),
      };
    }
    return where;
  }

  private buildArticleDateFilter(filters: StatsFilter): Prisma.ArticleWhereInput {
    if (!filters.startDate && !filters.endDate) {
      return {};
    }

    const range = {
      ...(filters.startDate ? { gte: filters.startDate } : {}),
      ...(filters.endDate ? { lte: filters.endDate } : {}),
    };

    return {
      articleCreatedAt: range,
    };
  }

  private buildCreatedArticleWhere(filters: StatsFilter): Prisma.ArticleWhereInput {
    const dateFilter = this.buildArticleDateFilter(filters);
    const base: Prisma.ArticleWhereInput = {
      ...(filters.wikiProject ? { wikiProject: filters.wikiProject } : {}),
    };

    if (filters.source === "MEDIAWIKI") {
      return {
        ...base,
        ...dateFilter,
        source: "MEDIAWIKI",
        ...(filters.editorId
          ? { createdByEditorId: filters.editorId }
          : { createdByEditorId: { not: null } }),
      };
    }

    if (filters.source === "OUTREACH_DASHBOARD") {
      return {
        ...base,
        ...dateFilter,
        source: "OUTREACH_DASHBOARD",
        isNewArticle: true,
        ...(filters.editorId
          ? { editors: { some: { editorId: filters.editorId, isAuthor: true } } }
          : {}),
      };
    }

    return {
      ...base,
      ...dateFilter,
      OR: [
        {
          ...(filters.editorId
            ? { createdByEditorId: filters.editorId }
            : { createdByEditorId: { not: null } }),
        },
        {
          isNewArticle: true,
          ...(filters.editorId
            ? { editors: { some: { editorId: filters.editorId, isAuthor: true } } }
            : {}),
        },
      ],
    };
  }

  private buildModifiedArticleWhere(filters: StatsFilter): Prisma.ArticleWhereInput {
    const base: Prisma.ArticleWhereInput = {
      ...(filters.wikiProject ? { wikiProject: filters.wikiProject } : {}),
    };

    const contributionFilter = this.buildContributionFilter(filters);
    const mediawikiCondition: Prisma.ArticleWhereInput = {
      contributions: { some: contributionFilter },
    };

    const outreachCondition: Prisma.ArticleWhereInput = {
      source: "OUTREACH_DASHBOARD",
      ...this.buildArticleDateFilter(filters),
      ...(filters.editorId ? { editors: { some: { editorId: filters.editorId } } } : {}),
    };

    if (filters.source === "MEDIAWIKI") {
      return { ...base, source: "MEDIAWIKI", ...mediawikiCondition };
    }

    if (filters.source === "OUTREACH_DASHBOARD") {
      return { ...base, ...outreachCondition };
    }

    return {
      ...base,
      OR: [mediawikiCondition, outreachCondition],
    };
  }

  private async getLatestCumulativePageviews(filters: StatsFilter) {
    return this.prisma.pageview.findMany({
      where: this.buildPageviewWhere(filters, "CUMULATIVE"),
      select: {
        articleId: true,
        date: true,
        views: true,
        cumulativeViews: true,
        article: { select: { wikiProject: true, createdByEditorId: true } },
      },
      orderBy: [{ articleId: "asc" }, { date: "desc" }],
      distinct: ["articleId"],
    });
  }

  private async getTotalPageviews(filters: StatsFilter): Promise<number> {
    // Read from pre-aggregated snapshots (viewsTotal), the single source of
    // truth — consistent with snapshot reports and the daily-first rollups.
    // Views are attributed to articles with program contributions only, and
    // counted from each article's earliest program contribution onward.
    const start = filters.startDate ? new Date(filters.startDate) : new Date(Date.UTC(2026, 0, 1));
    const end = filters.endDate ? new Date(filters.endDate) : new Date();
    const periodMs = end.getTime() - start.getTime();
    const granularity =
      periodMs <= 32 * 86400_000 ? "DAY" : periodMs <= 400 * 86400_000 ? "MONTH" : "YEAR";

    const rows = await this.prisma.metricSnapshot.findMany({
      where: {
        granularity,
        periodStart: {
          gte: start,
          lte: end,
        },
        ...(filters.wikiProject ? { wikiProject: filters.wikiProject } : {}),
      },
      select: { viewsTotal: true },
    });

    return rows.reduce((sum, row) => sum + (row.viewsTotal ?? 0), 0);
  }

  private async getPageviewsByWikiProject(filters: StatsFilter): Promise<Map<string, number>> {
    // Per-wiki pageview breakdown: distribute the canonical snapshot total
    // (viewsTotal, cutoff-aware) proportionally by per-wiki active-article
    // views from period_article_activity DAY rows. This keeps the breakdown
    // summing to the global total (consistent with reports).
    const start = filters.startDate ? new Date(filters.startDate) : new Date(Date.UTC(2026, 0, 1));
    const end = filters.endDate ? new Date(filters.endDate) : new Date();

    // 1) Global canonical total (from snapshots).
    const periodMs = end.getTime() - start.getTime();
    const granularity =
      periodMs <= 32 * 86400_000 ? "DAY" : periodMs <= 400 * 86400_000 ? "MONTH" : "YEAR";
    const snapRows = await this.prisma.metricSnapshot.findMany({
      where: { granularity, periodStart: { gte: start, lte: end } },
      select: { viewsTotal: true },
    });
    const globalTotal = snapRows.reduce((s, r) => s + (r.viewsTotal ?? 0), 0);

    // 2) Per-wiki active-article views (relative distribution).
    const rows = await this.prisma.periodArticleActivity.findMany({
      where: {
        granularity: "DAY",
        periodStart: { gte: start, lt: end },
      },
      select: {
        viewsTotal: true,
        article: { select: { wikiProject: true } },
      },
    });

    const perWiki = new Map<string, number>();
    let perWikiSum = 0;
    for (const row of rows) {
      const project = row.article.wikiProject ?? "unknown";
      const v = row.viewsTotal ?? 0;
      perWiki.set(project, (perWiki.get(project) ?? 0) + v);
      perWikiSum += v;
    }

    const totals = new Map<string, number>();
    if (perWikiSum > 0) {
      for (const [project, v] of perWiki) {
        totals.set(project, Math.round((v / perWikiSum) * globalTotal));
      }
    }
    return totals;
  }

  private buildContributionWhere(filters: StatsFilter): Prisma.ContributionWhereInput {
    const where: Prisma.ContributionWhereInput = {};
    if (filters.editorId) {
      where.editorId = filters.editorId;
    }
    if (filters.startDate || filters.endDate) {
      where.editTimestamp = {
        ...(filters.startDate ? { gte: filters.startDate } : {}),
        ...(filters.endDate ? { lte: filters.endDate } : {}),
      };
    }
    if (filters.wikiProject || filters.source) {
      where.article = {
        ...(filters.wikiProject ? { wikiProject: filters.wikiProject } : {}),
        ...(filters.source ? { source: filters.source } : {}),
      };
    }
    return where;
  }

  private buildPageviewWhere(filters: StatsFilter, type: PageviewType): Prisma.PageviewWhereInput {
    const resolvedSource =
      filters.source ?? (type === "DAILY" ? "MEDIAWIKI" : "OUTREACH_DASHBOARD");

    const articleWhere: Prisma.ArticleWhereInput = {
      ...(filters.wikiProject ? { wikiProject: filters.wikiProject } : {}),
      ...(resolvedSource ? { source: resolvedSource } : {}),
    };

    if (type === "DAILY") {
      // Views are attributed to all articles with program contributions
      // (created OR edited), consistent with snapshot viewsTotal.
      articleWhere.contributions = filters.editorId
        ? { some: { editorId: filters.editorId } }
        : { some: {} };
    } else {
      articleWhere.isNewArticle = true;
      if (filters.editorId) {
        // ArticleEditor table removed — filter by contributions instead.
        articleWhere.contributions = { some: { editorId: filters.editorId, isCreation: true } };
      }
    }

    const where: Prisma.PageviewWhereInput = {
      type,
      agentType: "ALL_AGENTS",
      article: { is: articleWhere },
    };

    if (filters.startDate || filters.endDate) {
      where.date = {
        ...(filters.startDate ? { gte: filters.startDate } : {}),
        ...(filters.endDate ? { lte: filters.endDate } : {}),
      };
    }

    return where;
  }

  private buildCommonsWhere(filters: StatsFilter): Prisma.CommonsUploadWhereInput {
    const where: Prisma.CommonsUploadWhereInput = {};
    if (filters.editorId) {
      where.editorId = filters.editorId;
    }
    if (filters.startDate || filters.endDate) {
      where.uploadedAt = {
        ...(filters.startDate ? { gte: filters.startDate } : {}),
        ...(filters.endDate ? { lte: filters.endDate } : {}),
      };
    }
    return where;
  }

  private async getPeriodTotals(
    startDate: Date,
    endDate: Date,
    filters?: { wikiProject?: string; source?: ArticleSource },
  ): Promise<AnnualStats> {
    const scopedFilters: StatsFilter = {
      startDate,
      endDate,
      wikiProject: filters?.wikiProject,
      source: filters?.source,
    };

    const overall = await this.getOverallStats(scopedFilters);
    const editors = await this.getStatsByEditor(scopedFilters);
    const createdArticles = await this.prisma.article.findMany({
      where: this.buildCreatedArticleWhere(scopedFilters),
      select: { referencesCount: true },
    });

    const referencesAdded = createdArticles.reduce(
      (sum, item) => sum + (item.referencesCount ?? 0),
      0,
    );

    return {
      edits: overall.edits,
      wordsAdded: overall.wordsAdded,
      pageviews: overall.pageviews,
      articlesCreated: overall.articlesCreated,
      articlesEdited: overall.articlesModified,
      editors: editors.length,
      referencesAdded,
      commonsUploads: overall.commonsUploads,
    };
  }

  private async getPeriodWikiTotals(
    startDate: Date,
    endDate: Date,
    filters?: { wikiProject?: string; source?: ArticleSource },
  ): Promise<WikiProjectAnnualStats[]> {
    const scopedFilters: StatsFilter = {
      startDate,
      endDate,
      wikiProject: filters?.wikiProject,
      source: filters?.source,
    };

    const baseStats = await this.getStatsByWikiProject(scopedFilters);
    const wikiMap = new Map<string, WikiProjectAnnualStats>();

    for (const stat of baseStats) {
      wikiMap.set(stat.wikiProject, {
        wikiProject: stat.wikiProject,
        edits: stat.edits,
        wordsAdded: stat.wordsAdded,
        pageviews: stat.pageviews,
        articlesCreated: stat.articlesCreated,
        articlesEdited: stat.articlesModified,
        editors: 0,
        referencesAdded: 0,
        commonsUploads: stat.commonsUploads,
      });
    }

    const contributions = await this.prisma.contribution.findMany({
      where: this.buildContributionWhere(scopedFilters),
      select: {
        editorId: true,
        article: { select: { wikiProject: true } },
      },
    });

    const editorsByWiki = new Map<string, Set<string>>();
    for (const row of contributions) {
      const project = row.article.wikiProject;
      const set = editorsByWiki.get(project) ?? new Set<string>();
      set.add(row.editorId);
      editorsByWiki.set(project, set);
    }

    const createdArticles = await this.prisma.contribution.findMany({
      where: { ...this.buildContributionWhere(scopedFilters), isCreation: true },
      distinct: ["articleId"],
      select: { article: { select: { wikiProject: true } } },
    });

    for (const row of createdArticles) {
      const project = row.article.wikiProject;
      const item = wikiMap.get(project) ?? {
        wikiProject: project,
        edits: 0,
        wordsAdded: 0,
        pageviews: 0,
        articlesCreated: 0,
        articlesEdited: 0,
        editors: 0,
        referencesAdded: 0,
        commonsUploads: 0,
      };
      item.articlesCreated += 1;
      wikiMap.set(project, item);
    }

    for (const [project, editorSet] of editorsByWiki.entries()) {
      const item = wikiMap.get(project) ?? {
        wikiProject: project,
        edits: 0,
        wordsAdded: 0,
        pageviews: 0,
        articlesCreated: 0,
        articlesEdited: 0,
        editors: 0,
        referencesAdded: 0,
        commonsUploads: 0,
      };
      item.editors = editorSet.size;
      wikiMap.set(project, item);
    }

    return Array.from(wikiMap.values()).sort((a, b) => b.edits - a.edits);
  }

  private async getMonthlyPerformance(
    year: number,
    filters?: { wikiProject?: string; source?: ArticleSource },
  ): Promise<PeriodPerformancePoint[]> {
    const articleWhere = {
      ...(filters?.wikiProject ? { wikiProject: filters.wikiProject } : {}),
      ...(filters?.source ? { source: filters.source } : {}),
    };
    const points: PeriodPerformancePoint[] = [];
    // Enrolled-at map for program attribution: contributions before a member's
    // enrollment are excluded from monthly metrics.
    const enrolledAtByEditor = await this.getEnrolledAtByEditorMap();
    // Pre-aggregated MONTH snapshots (cutoff-aware) for pageview totals.
    const monthSnapshots = await this.prisma.metricSnapshot.findMany({
      where: {
        granularity: "MONTH",
        periodStart: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
        ...(filters?.wikiProject ? { wikiProject: filters.wikiProject } : {}),
      },
      select: { periodStart: true, viewsTotal: true, edits: true },
    });
    const viewsByMonth = new Map<number, number>();
    const snapshotEditsByMonth = new Map<number, number>();
    for (const snap of monthSnapshots) {
      viewsByMonth.set(snap.periodStart.getUTCMonth(), snap.viewsTotal ?? 0);
      snapshotEditsByMonth.set(snap.periodStart.getUTCMonth(), snap.edits ?? 0);
    }
    for (let month = 1; month <= 12; month++) {
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));
      const [contributions, created, commonsUploads] =
        await Promise.all([
          this.prisma.contribution.findMany({
            where: { editTimestamp: { gte: start, lt: end }, article: articleWhere },
            select: { articleId: true, editorId: true, wordsAdded: true, editTimestamp: true },
          }),
          this.prisma.contribution.findMany({
            where: {
              editTimestamp: { gte: start, lt: end },
              isCreation: true,
              article: articleWhere,
            },
            distinct: ["articleId"],
            select: { articleId: true },
          }),
          this.prisma.commonsUpload.count({ where: { uploadedAt: { gte: start, lt: end } } }),
        ]);
      const eligibleContributions = contributions.filter((row) => {
        const enrolledAt = enrolledAtByEditor.get(row.editorId);
        return !enrolledAt || row.editTimestamp >= enrolledAt;
      });
      const editors = new Set(eligibleContributions.map((row) => row.editorId));
      const editedArticles = new Set(eligibleContributions.map((row) => row.articleId));
      const pageviews = viewsByMonth.get(month - 1) ?? 0;
      points.push({
        period: `${year}-${String(month).padStart(2, "0")}`,
        edits: eligibleContributions.length,
        wordsAdded: eligibleContributions.reduce((sum, row) => sum + row.wordsAdded, 0),
        pageviews: pageviews as number,
        articlesCreated: created.length,
        articlesEdited: editedArticles.size,
        editors: editors.size,
        referencesAdded: 0,
        commonsUploads,
      });
    }
    return points;
  }

  private async getDailyPerformance(
    startDate: Date,
    endDate: Date,
    filters?: { wikiProject?: string; source?: ArticleSource },
  ): Promise<PeriodPerformancePoint[]> {
    // Daily performance derived from MetricSnapshot DAY rows (source of truth).
    const rows = await this.prisma.metricSnapshot.findMany({
      where: {
        granularity: "DAY",
        periodStart: { gte: toUtcDate(startDate), lte: toUtcDate(endDate) },
        ...(filters?.wikiProject ? { wikiProject: filters.wikiProject } : {}),
      },
      orderBy: { periodStart: "asc" },
    });

    return rows.map((row) => ({
      period: row.periodStart.toISOString().slice(0, 10),
      edits: row.edits,
      wordsAdded: row.wordsAdded,
      pageviews: row.viewsTotal,
      articlesCreated: row.articlesCreated,
      articlesEdited: row.articlesEdited,
      editors: row.editors,
      referencesAdded: row.refsAdded,
      commonsUploads: row.commonsUploads,
    }));
  }

  async getImpactReport(year: number, topLimit = 10, includeMonthly = false) {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
    const [articles, contributions, periodActivity, yearSnapshot, commonsGroups, enrolledAtByEditor] =
      await Promise.all([
        this.prisma.article.findMany({
          where: {
            contributions: { some: { isCreation: true, editTimestamp: { gte: start, lt: end } } },
          },
          select: {
            id: true,
            title: true,
            wikiProject: true,
            articleCreatedAt: true,
            isNewArticle: true,
          },
        }),
        this.prisma.contribution.findMany({
          where: { editTimestamp: { gte: start, lt: end } },
          select: { articleId: true, editorId: true, wordsAdded: true, editTimestamp: true },
        }),
        // Pre-aggregated per-article activity (DAY rows, cutoff-aware) used for
        // relative top-article ranking.
        this.prisma.periodArticleActivity.findMany({
          where: { granularity: "DAY", periodStart: { gte: start, lt: end } },
          select: { articleId: true, viewsActive: true },
        }),
        // Canonical yearly totals (cutoff-aware) — single source of truth.
        this.prisma.metricSnapshot.findFirst({
          where: { granularity: "YEAR", periodStart: { gte: start, lt: end } },
          select: { viewsTotal: true },
        }),
        this.prisma.commonsUpload.count({ where: { uploadedAt: { gte: start, lt: end } } }),
        this.getEnrolledAtByEditorMap(),
      ]);

    // Exclude contributions made before the editor joined the program.
    const eligibleContributions = contributions.filter((row) => {
      const enrolledAt = enrolledAtByEditor.get(row.editorId);
      return !enrolledAt || row.editTimestamp >= enrolledAt;
    });

    const articleMap = new Map(articles.map((article) => [article.id, article]));
    // Roll up DAY rows per article (relative ranking signal).
    const pageviewsByArticle = new Map<string, number>();
    for (const row of periodActivity) {
      pageviewsByArticle.set(row.articleId, (pageviewsByArticle.get(row.articleId) ?? 0) + (row.viewsActive ?? 0));
    }
    const pageviewArticleRows = await this.prisma.article.findMany({
      where: { id: { in: Array.from(pageviewsByArticle.keys()) } },
      select: { id: true, title: true, wikiProject: true },
    });
    for (const article of pageviewArticleRows)
      articleMap.set(article.id, article as (typeof articles)[number]);
    const createdIds = new Set(articles.map((article) => article.id));
    const editedIds = new Set(eligibleContributions.map((row) => row.articleId));
    const editorIds = new Set(eligibleContributions.map((row) => row.editorId));
    const byWiki = new Map<
      string,
      {
        wikiProject: string;
        articlesCreated: number;
        articlesEdited: number;
        edits: number;
        wordsAdded: number;
        pageviews: number;
      }
    >();
    const ensure = (wikiProject: string) => {
      const current = byWiki.get(wikiProject) ?? {
        wikiProject,
        articlesCreated: 0,
        articlesEdited: 0,
        edits: 0,
        wordsAdded: 0,
        pageviews: 0,
      };
      byWiki.set(wikiProject, current);
      return current;
    };
    for (const article of articles) {
      ensure(article.wikiProject).articlesCreated += 1;
    }
    for (const row of eligibleContributions) {
      const article = articleMap.get(row.articleId);
      if (!article) continue;
      const target = ensure(article.wikiProject);
      target.edits += 1;
      target.wordsAdded += row.wordsAdded;
    }
    for (const [articleId, views] of pageviewsByArticle) {
      const article = articleMap.get(articleId);
      if (article) ensure(article.wikiProject).pageviews += views;
    }
    // Distribute canonical yearly pageview total proportionally per wiki so
    // the breakdown sums to totals.pageviews (61M+), consistent with reports.
    const wikiActive = new Map<string, number>();
    let wikiActiveSum = 0;
    for (const [project, row] of byWiki) {
      wikiActive.set(project, row.pageviews);
      wikiActiveSum += row.pageviews;
    }
    const canonicalViews = yearSnapshot?.viewsTotal ?? 0;
    if (wikiActiveSum > 0) {
      for (const [project, row] of byWiki) {
        row.pageviews = Math.round((wikiActive.get(project)! / wikiActiveSum) * canonicalViews);
      }
    }
    for (const [wikiProject, row] of byWiki) {
      row.articlesEdited = new Set(
        eligibleContributions
          .filter((item) => articleMap.get(item.articleId)?.wikiProject === wikiProject)
          .map((item) => item.articleId),
      ).size;
    }
    const topArticles = Array.from(pageviewsByArticle.entries())
      .map(([articleId, totalPageviews]) => ({
        article: articleMap.get(articleId),
        articleId,
        totalPageviews,
      }))
      .filter((row) => row.article)
      .sort((a, b) => b.totalPageviews - a.totalPageviews)
      .slice(0, topLimit)
      .map((row, index) => ({
        rank: index + 1,
        articleId: row.articleId,
        title: row.article!.title,
        wikiProject: row.article!.wikiProject,
        totalPageviews: row.totalPageviews,
      }));
    const totals = {
      articlesCreated: createdIds.size,
      articlesEdited: editedIds.size,
      edits: eligibleContributions.length,
      wordsAdded: eligibleContributions.reduce((sum, row) => sum + row.wordsAdded, 0),
      pageviews: yearSnapshot?.viewsTotal ?? null,
      editors: editorIds.size,
      referencesAdded: null,
      commonsUploads: commonsGroups,
    };
    return {
      year,
      totals,
      byWikiProject: Array.from(byWiki.values()).sort((a, b) =>
        a.wikiProject.localeCompare(b.wikiProject),
      ),
      monthlyPerformance: includeMonthly ? await this.getMonthlyPerformance(year) : [],
      topArticles,
      methodology: {
        pageviews:
          "Pre-aggregated period article activity (YEAR) built from Wikimedia DAILY/ALL_AGENTS rows with the earliest-program-contribution cutoff",
        articlesCreated:
          "Articles with a first tracked creation contribution within the selected calendar year",
        wordsAdded: "Estimated from contribution bytes using the existing wordsAdded metric",
        referencesAdded: "Not available as a year-delta in current source data",
      },
    };
  }

  async getAnnualStats(
    year: number,
    filters?: { wikiProject?: string; source?: ArticleSource },
  ): Promise<{
    byWikiProject: WikiProjectAnnualStats[];
    totals: AnnualStats;
    monthlyPerformance: PeriodPerformancePoint[];
  }> {
    const startOfYear = new Date(Date.UTC(year, 0, 1));
    const endOfYear = new Date(Date.UTC(year + 1, 0, 1) - 1);

    const [totals, byWikiProject, monthlyPerformance] = await Promise.all([
      this.getPeriodTotals(startOfYear, endOfYear, filters),
      this.getPeriodWikiTotals(startOfYear, endOfYear, filters),
      this.getMonthlyPerformance(year, filters),
    ]);

    return { byWikiProject, totals, monthlyPerformance };
  }

  async getMonthlyStats(
    year: number,
    month: number,
    filters?: { wikiProject?: string; source?: ArticleSource },
  ): Promise<{
    byWikiProject: WikiProjectAnnualStats[];
    totals: AnnualStats;
    dailyPerformance: PeriodPerformancePoint[];
  }> {
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, month, 1) - 1);

    const [legacyTotals, byWikiProject, dailyPerformance, monthlyPerformance] = await Promise.all([
      this.getPeriodTotals(startOfMonth, endOfMonth, filters),
      this.getPeriodWikiTotals(startOfMonth, endOfMonth, filters),
      this.getDailyPerformance(startOfMonth, endOfMonth, filters),
      this.getMonthlyPerformance(year, filters),
    ]);
    const nextMonth = new Date(Date.UTC(year, month, 1));
    // Per-wiki pageview breakdown (proportional to canonical snapshot total).
    const pageviewsByWiki = await this.getPageviewsByWikiProject({
      startDate: startOfMonth,
      endDate: endOfMonth,
      ...(filters?.wikiProject ? { wikiProject: filters.wikiProject } : {}),
    });
    for (const row of byWikiProject) row.pageviews = pageviewsByWiki.get(row.wikiProject) ?? 0;
    const point = monthlyPerformance[month - 1];
    const totals = point
      ? { ...legacyTotals, ...point, referencesAdded: legacyTotals.referencesAdded }
      : legacyTotals;

    return { byWikiProject, totals, dailyPerformance };
  }

  async calculateYoY(
    currentYear: number,
    metric: keyof AnnualStats | "all" = "all",
  ): Promise<YoYComparison> {
    const current = await this.getAnnualStats(currentYear);
    const previous = await this.getAnnualStats(currentYear - 1);

    const calculateChange = (
      currentVal: number,
      previousVal: number,
    ): { current: number; previous: number; changePercent: number } => {
      const changePercent =
        previousVal === 0 ? 0 : ((currentVal - previousVal) / previousVal) * 100;
      return {
        current: currentVal,
        previous: previousVal,
        changePercent: Number(changePercent.toFixed(2)),
      };
    };

    if (metric === "all") {
      return {
        edits: calculateChange(current.totals.edits, previous.totals.edits),
        wordsAdded: calculateChange(current.totals.wordsAdded, previous.totals.wordsAdded),
        pageviews: calculateChange(current.totals.pageviews, previous.totals.pageviews),
        articlesCreated: calculateChange(
          current.totals.articlesCreated,
          previous.totals.articlesCreated,
        ),
        articlesEdited: calculateChange(
          current.totals.articlesEdited,
          previous.totals.articlesEdited,
        ),
        editors: calculateChange(current.totals.editors, previous.totals.editors),
        referencesAdded: calculateChange(
          current.totals.referencesAdded,
          previous.totals.referencesAdded,
        ),
        commonsUploads: calculateChange(
          current.totals.commonsUploads,
          previous.totals.commonsUploads,
        ),
      };
    }

    return {
      [metric]: calculateChange(current.totals[metric], previous.totals[metric]),
    } as YoYComparison;
  }

  private async getTopArticlesForRange(
    startDate: Date,
    endDate: Date,
    limit: number,
    wikiProject?: string,
  ): Promise<TopArticle[]> {
    // Top articles by views derived from PeriodArticleActivity snapshot rows
    // (source of truth), aggregated over the range.
    const grouped = await this.prisma.periodArticleActivity.groupBy({
      by: ["articleId"],
      where: {
        granularity: "MONTH",
        periodStart: { gte: toUtcDate(startDate), lte: toUtcDate(endDate) },
        ...(wikiProject ? { wikiProject } : {}),
      },
      _sum: { viewsTotal: true },
    });
    const ranked = grouped
      .map((row) => ({ articleId: row.articleId, totalPageviews: row._sum.viewsTotal ?? 0 }))
      .filter((row) => row.totalPageviews > 0)
      .sort((a, b) => b.totalPageviews - a.totalPageviews)
      .slice(0, Math.max(limit * 5, limit));
    if (ranked.length === 0) return [];
    const articles = await this.prisma.article.findMany({
      where: {
        id: { in: ranked.map((row) => row.articleId) },
        ...(wikiProject ? { wikiProject } : {}),
      },
      select: { id: true, title: true, wikiProject: true },
    });
    const metadata = new Map(articles.map((article) => [article.id, article]));
    return ranked
      .filter((row) => metadata.has(row.articleId))
      .slice(0, limit)
      .map((row, index) => ({
        rank: index + 1,
        articleId: row.articleId,
        title: metadata.get(row.articleId)!.title,
        wikiProject: metadata.get(row.articleId)!.wikiProject,
        totalPageviews: row.totalPageviews,
      }));
  }

  async getTopArticlesByYear(
    year: number,
    limit: number,
    wikiProject?: string,
  ): Promise<TopArticle[]> {
    return this.getTopArticlesForRange(
      new Date(Date.UTC(year, 0, 1)),
      new Date(Date.UTC(year + 1, 0, 1)),
      limit,
      wikiProject,
    );
  }

  async getTopArticlesByPeriod(
    startDate: Date,
    endDate: Date,
    limit: number,
    wikiProject?: string,
  ): Promise<TopArticle[]> {
    const endExclusive = new Date(endDate.getTime() + 1);
    return this.getTopArticlesForRange(startDate, endExclusive, limit, wikiProject);
  }
}
