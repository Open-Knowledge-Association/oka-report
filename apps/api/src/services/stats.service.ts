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

export type TimeSeriesPoint = {
  date: string;
  edits: number;
  wordsAdded: number;
  pageviews: number;
  articlesCreated: number;
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

const bucketDate = (date: Date, granularity: Granularity) => {
  if (granularity === "monthly") {
    return formatDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
  }

  if (granularity === "weekly") {
    return formatDate(startOfWeekUtc(date));
  }

  return formatDate(date);
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

  async getPeriodActivitySummary(
    startDate: Date,
    endDateInclusive: Date,
    filters: { wikiProject?: string; source?: ArticleSource } = {},
  ): Promise<AnnualStats> {
    const start = toUtcDate(startDate);
    const end = addUtcDays(toUtcDate(endDateInclusive), 1);
    const articleFilter: Prisma.ArticleWhereInput = {
      ...(filters.wikiProject ? { wikiProject: filters.wikiProject } : {}),
      ...(filters.source ? { source: filters.source } : {}),
    };
    const contributionWhere: Prisma.ContributionWhereInput = {
      editTimestamp: { gte: start, lt: end },
      ...(Object.keys(articleFilter).length ? { article: articleFilter } : {}),
    };
    const [contributions, views, uploads] = await Promise.all([
      this.prisma.contribution.findMany({
        where: contributionWhere,
        select: { articleId: true, editorId: true, isCreation: true, wordsAdded: true },
      }),
      this.prisma.pageview.aggregate({
        where: {
          date: { gte: start, lt: end },
          type: "DAILY",
          agentType: "ALL_AGENTS",
          ...(Object.keys(articleFilter).length ? { article: articleFilter } : {}),
        },
        _sum: { views: true },
      }),
      this.prisma.commonsUpload.count({ where: { uploadedAt: { gte: start, lt: end } } }),
    ]);
    const createdIds = new Set(
      contributions.filter((row) => row.isCreation).map((row) => row.articleId),
    );
    const createdArticles = await this.prisma.article.findMany({
      where: { id: { in: Array.from(createdIds) } },
      select: { referencesCount: true },
    });
    return {
      edits: contributions.length,
      wordsAdded: contributions.reduce((sum, row) => sum + row.wordsAdded, 0),
      pageviews: views._sum.views ?? 0,
      articlesCreated: createdIds.size,
      articlesEdited: new Set(contributions.map((row) => row.articleId)).size,
      editors: new Set(contributions.map((row) => row.editorId)).size,
      referencesAdded: createdArticles.reduce((sum, row) => sum + row.referencesCount, 0),
      commonsUploads: uploads,
    };
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

  async getDailyHistory(range: {
    startDate?: Date;
    endDate?: Date;
    wikiProject?: string;
    source?: ArticleSource;
  }) {
    const startDate = range.startDate ? toUtcDate(range.startDate) : undefined;
    const endDate = range.endDate ? toUtcDate(range.endDate) : undefined;

    if (range.wikiProject && range.source) {
      return this.prisma.dailyWikiSourceStat.findMany({
        where: {
          wikiProject: range.wikiProject,
          source: range.source,
          ...(startDate || endDate
            ? {
                date: {
                  ...(startDate ? { gte: startDate } : {}),
                  ...(endDate ? { lte: endDate } : {}),
                },
              }
            : {}),
        },
        orderBy: { date: "asc" },
      });
    }

    if (range.source) {
      return this.prisma.dailySourceStat.findMany({
        where: {
          source: range.source,
          ...(startDate || endDate
            ? {
                date: {
                  ...(startDate ? { gte: startDate } : {}),
                  ...(endDate ? { lte: endDate } : {}),
                },
              }
            : {}),
        },
        orderBy: { date: "asc" },
      });
    }

    if (range.wikiProject) {
      return this.prisma.dailyWikiStat.findMany({
        where: {
          wikiProject: range.wikiProject,
          ...(startDate || endDate
            ? {
                date: {
                  ...(startDate ? { gte: startDate } : {}),
                  ...(endDate ? { lte: endDate } : {}),
                },
              }
            : {}),
        },
        orderBy: { date: "asc" },
      });
    }

    return this.prisma.dailyStat.findMany({
      where: {
        ...(startDate || endDate
          ? {
              date: {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: "asc" },
    });
  }

  async getEditorDailyHistory(editorId: string, range: { startDate?: Date; endDate?: Date }) {
    const startDate = range.startDate ? toUtcDate(range.startDate) : undefined;
    const endDate = range.endDate ? toUtcDate(range.endDate) : undefined;

    return this.prisma.editorDailyStat.findMany({
      where: {
        editorId,
        ...(startDate || endDate
          ? {
              date: {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: "asc" },
    });
  }

  async getArticleDailyHistory(articleId: string, range: { startDate?: Date; endDate?: Date }) {
    const startDate = range.startDate ? toUtcDate(range.startDate) : undefined;
    const endDate = range.endDate ? toUtcDate(range.endDate) : undefined;

    return this.prisma.articleDailyStat.findMany({
      where: {
        articleId,
        ...(startDate || endDate
          ? {
              date: {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: "asc" },
    });
  }

  async recordDailySnapshots(startDate: Date, endDate: Date) {
    let current = toUtcDate(startDate);
    const last = toUtcDate(endDate);

    while (current <= last) {
      await this.recordDailySnapshot(current);
      current = addUtcDays(current, 1);
    }
  }

  async recordDailySnapshot(date: Date) {
    const dayStart = toUtcDate(date);
    const dayEnd = addUtcDays(dayStart, 1);

    const contributions = await this.prisma.contribution.findMany({
      where: { editTimestamp: { gte: dayStart, lt: dayEnd } },
      select: {
        editorId: true,
        articleId: true,
        wordsAdded: true,
        isCreation: true,
        article: { select: { wikiProject: true, source: true } },
      },
    });

    const edits = contributions.length;
    const wordsAdded = contributions.reduce((sum, item) => sum + item.wordsAdded, 0);

    const editorSet = new Set<string>();
    const editedArticleSet = new Set<string>();
    const createdArticleSet = new Set<string>();
    const wikiStats = new Map<
      string,
      {
        edits: number;
        wordsAdded: number;
        pageviews: number;
        createdArticles: Set<string>;
        editedArticles: Set<string>;
        editors: Set<string>;
        referencesAdded: number;
        commonsUploads: number;
      }
    >();
    const sourceStats = new Map<
      ArticleSource,
      {
        edits: number;
        wordsAdded: number;
        pageviews: number;
        createdArticles: Set<string>;
        editedArticles: Set<string>;
        editors: Set<string>;
        referencesAdded: number;
        commonsUploads: number;
      }
    >();
    const editorStats = new Map<
      string,
      {
        edits: number;
        wordsAdded: number;
        createdArticles: Set<string>;
        editedArticles: Set<string>;
        referencesAdded: number;
        commonsUploads: number;
      }
    >();
    const wikiSourceStats = new Map<
      string,
      {
        wikiProject: string;
        source: ArticleSource;
        edits: number;
        wordsAdded: number;
        pageviews: number;
        createdArticles: Set<string>;
        editedArticles: Set<string>;
        editors: Set<string>;
        referencesAdded: number;
        commonsUploads: number;
      }
    >();

    for (const contribution of contributions) {
      editorSet.add(contribution.editorId);
      editedArticleSet.add(contribution.articleId);

      const wikiProject = contribution.article.wikiProject;
      let wikiStat = wikiStats.get(wikiProject);
      if (!wikiStat) {
        wikiStat = {
          edits: 0,
          wordsAdded: 0,
          pageviews: 0,
          createdArticles: new Set<string>(),
          editedArticles: new Set<string>(),
          editors: new Set<string>(),
          referencesAdded: 0,
          commonsUploads: 0,
        };
        wikiStats.set(wikiProject, wikiStat);
      }

      wikiStat.edits += 1;
      wikiStat.wordsAdded += contribution.wordsAdded;
      wikiStat.editedArticles.add(contribution.articleId);
      wikiStat.editors.add(contribution.editorId);

      const source = contribution.article.source;
      let sourceStat = sourceStats.get(source);
      if (!sourceStat) {
        sourceStat = {
          edits: 0,
          wordsAdded: 0,
          pageviews: 0,
          createdArticles: new Set<string>(),
          editedArticles: new Set<string>(),
          editors: new Set<string>(),
          referencesAdded: 0,
          commonsUploads: 0,
        };
        sourceStats.set(source, sourceStat);
      }

      sourceStat.edits += 1;
      sourceStat.wordsAdded += contribution.wordsAdded;
      sourceStat.editedArticles.add(contribution.articleId);
      sourceStat.editors.add(contribution.editorId);

      const wikiSourceKey = `${wikiProject}::${source}`;
      let wikiSourceStat = wikiSourceStats.get(wikiSourceKey);
      if (!wikiSourceStat) {
        wikiSourceStat = {
          wikiProject,
          source,
          edits: 0,
          wordsAdded: 0,
          pageviews: 0,
          createdArticles: new Set<string>(),
          editedArticles: new Set<string>(),
          editors: new Set<string>(),
          referencesAdded: 0,
          commonsUploads: 0,
        };
        wikiSourceStats.set(wikiSourceKey, wikiSourceStat);
      }
      wikiSourceStat.edits += 1;
      wikiSourceStat.wordsAdded += contribution.wordsAdded;
      wikiSourceStat.editedArticles.add(contribution.articleId);
      wikiSourceStat.editors.add(contribution.editorId);

      let stats = editorStats.get(contribution.editorId);
      if (!stats) {
        stats = {
          edits: 0,
          wordsAdded: 0,
          createdArticles: new Set<string>(),
          editedArticles: new Set<string>(),
          referencesAdded: 0,
          commonsUploads: 0,
        };
        editorStats.set(contribution.editorId, stats);
      }

      stats.edits += 1;
      stats.wordsAdded += contribution.wordsAdded;
      stats.editedArticles.add(contribution.articleId);

      if (contribution.isCreation) {
        createdArticleSet.add(contribution.articleId);
        stats.createdArticles.add(contribution.articleId);
        wikiStat.createdArticles.add(contribution.articleId);
        sourceStat.createdArticles.add(contribution.articleId);
        wikiSourceStat.createdArticles.add(contribution.articleId);
      }
    }

    const createdArticleIds = Array.from(createdArticleSet);
    const createdArticles =
      createdArticleIds.length > 0
        ? await this.prisma.article.findMany({
            where: { id: { in: createdArticleIds } },
            select: { id: true, referencesCount: true, wikiProject: true, source: true },
          })
        : [];

    const articlesCreated = createdArticleSet.size;
    const referencesAdded = createdArticles.reduce(
      (sum, article) => sum + (article.referencesCount ?? 0),
      0,
    );

    for (const article of createdArticles) {
      const wikiStat = wikiStats.get(article.wikiProject);
      if (wikiStat) {
        wikiStat.referencesAdded += article.referencesCount ?? 0;
      }

      const sourceStat = sourceStats.get(article.source);
      if (sourceStat) {
        sourceStat.referencesAdded += article.referencesCount ?? 0;
      }

      const wikiSourceKey = `${article.wikiProject}::${article.source}`;
      const wikiSourceStat = wikiSourceStats.get(wikiSourceKey);
      if (wikiSourceStat) {
        wikiSourceStat.referencesAdded += article.referencesCount ?? 0;
      }
    }

    const refsByArticleId = new Map(
      createdArticles.map((article) => [article.id, article.referencesCount ?? 0]),
    );

    for (const stats of editorStats.values()) {
      let totalRefs = 0;
      for (const articleId of stats.createdArticles) {
        totalRefs += refsByArticleId.get(articleId) ?? 0;
      }
      stats.referencesAdded = totalRefs;
    }

    const uploads = await this.prisma.commonsUpload.findMany({
      where: { uploadedAt: { gte: dayStart, lt: dayEnd } },
      select: { editorId: true },
    });

    for (const upload of uploads) {
      let stats = editorStats.get(upload.editorId);
      if (!stats) {
        stats = {
          edits: 0,
          wordsAdded: 0,
          createdArticles: new Set<string>(),
          editedArticles: new Set<string>(),
          referencesAdded: 0,
          commonsUploads: 0,
        };
        editorStats.set(upload.editorId, stats);
      }
      stats.commonsUploads += 1;
    }

    for (const wikiStat of wikiStats.values()) {
      for (const upload of uploads) {
        if (wikiStat.editors.has(upload.editorId)) {
          wikiStat.commonsUploads += 1;
        }
      }
    }

    for (const sourceStat of sourceStats.values()) {
      for (const upload of uploads) {
        if (sourceStat.editors.has(upload.editorId)) {
          sourceStat.commonsUploads += 1;
        }
      }
    }

    for (const wikiSourceStat of wikiSourceStats.values()) {
      for (const upload of uploads) {
        if (wikiSourceStat.editors.has(upload.editorId)) {
          wikiSourceStat.commonsUploads += 1;
        }
      }
    }

    const commonsUploads = uploads.length;
    const articlesEdited = editedArticleSet.size;
    const editors = editorSet.size;

    const dailyPageviews = await this.prisma.pageview.findMany({
      where: { date: dayStart, type: "DAILY", agentType: "ALL_AGENTS" },
      select: {
        articleId: true,
        views: true,
        article: { select: { wikiProject: true, source: true } },
      },
    });
    const pageviews = dailyPageviews.reduce((sum, item) => sum + item.views, 0);

    for (const item of dailyPageviews) {
      const wikiProject = item.article.wikiProject;
      let wikiStat = wikiStats.get(wikiProject);
      if (!wikiStat) {
        wikiStat = {
          edits: 0,
          wordsAdded: 0,
          pageviews: 0,
          createdArticles: new Set<string>(),
          editedArticles: new Set<string>(),
          editors: new Set<string>(),
          referencesAdded: 0,
          commonsUploads: 0,
        };
        wikiStats.set(wikiProject, wikiStat);
      }
      wikiStat.pageviews += item.views;

      const source = item.article.source;
      let sourceStat = sourceStats.get(source);
      if (!sourceStat) {
        sourceStat = {
          edits: 0,
          wordsAdded: 0,
          pageviews: 0,
          createdArticles: new Set<string>(),
          editedArticles: new Set<string>(),
          editors: new Set<string>(),
          referencesAdded: 0,
          commonsUploads: 0,
        };
        sourceStats.set(source, sourceStat);
      }
      sourceStat.pageviews += item.views;

      const wikiSourceKey = `${wikiProject}::${source}`;
      let wikiSourceStat = wikiSourceStats.get(wikiSourceKey);
      if (!wikiSourceStat) {
        wikiSourceStat = {
          wikiProject,
          source,
          edits: 0,
          wordsAdded: 0,
          pageviews: 0,
          createdArticles: new Set<string>(),
          editedArticles: new Set<string>(),
          editors: new Set<string>(),
          referencesAdded: 0,
          commonsUploads: 0,
        };
        wikiSourceStats.set(wikiSourceKey, wikiSourceStat);
      }
      wikiSourceStat.pageviews += item.views;
    }

    await this.prisma.dailyStat.upsert({
      where: { date: dayStart },
      update: {
        edits,
        wordsAdded,
        pageviews,
        articlesCreated,
        articlesEdited,
        editors,
        referencesAdded,
        commonsUploads,
      },
      create: {
        date: dayStart,
        edits,
        wordsAdded,
        pageviews,
        articlesCreated,
        articlesEdited,
        editors,
        referencesAdded,
        commonsUploads,
      },
    });

    const editorRows = Array.from(editorStats.entries()).map(([editorId, stats]) => ({
      date: dayStart,
      editorId,
      edits: stats.edits,
      wordsAdded: stats.wordsAdded,
      articlesCreated: stats.createdArticles.size,
      articlesEdited: stats.editedArticles.size,
      referencesAdded: stats.referencesAdded,
      commonsUploads: stats.commonsUploads,
    }));

    if (editorRows.length > 0) {
      await this.prisma.$transaction([
        this.prisma.editorDailyStat.deleteMany({ where: { date: dayStart } }),
        this.prisma.editorDailyStat.createMany({ data: editorRows }),
      ]);
    }

    await this.prisma.dailyWikiStat.deleteMany({ where: { date: dayStart } });

    const wikiRows = Array.from(wikiStats.entries()).map(([wikiProject, stats]) => ({
      date: dayStart,
      wikiProject,
      edits: stats.edits,
      wordsAdded: stats.wordsAdded,
      pageviews: stats.pageviews,
      articlesCreated: stats.createdArticles.size,
      articlesEdited: stats.editedArticles.size,
      editors: stats.editors.size,
      referencesAdded: stats.referencesAdded,
      commonsUploads: stats.commonsUploads,
    }));

    if (wikiRows.length > 0) {
      await this.prisma.dailyWikiStat.createMany({ data: wikiRows });
    }

    await this.prisma.dailySourceStat.deleteMany({ where: { date: dayStart } });

    const sourceRows = Array.from(sourceStats.entries()).map(([source, stats]) => ({
      date: dayStart,
      source,
      edits: stats.edits,
      wordsAdded: stats.wordsAdded,
      pageviews: stats.pageviews,
      articlesCreated: stats.createdArticles.size,
      articlesEdited: stats.editedArticles.size,
      editors: stats.editors.size,
      referencesAdded: stats.referencesAdded,
      commonsUploads: stats.commonsUploads,
    }));

    if (sourceRows.length > 0) {
      await this.prisma.dailySourceStat.createMany({ data: sourceRows });
    }

    await this.prisma.dailyWikiSourceStat.deleteMany({ where: { date: dayStart } });

    const wikiSourceRows = Array.from(wikiSourceStats.values()).map((stats) => ({
      date: dayStart,
      wikiProject: stats.wikiProject,
      source: stats.source,
      edits: stats.edits,
      wordsAdded: stats.wordsAdded,
      pageviews: stats.pageviews,
      articlesCreated: stats.createdArticles.size,
      articlesEdited: stats.editedArticles.size,
      editors: stats.editors.size,
      referencesAdded: stats.referencesAdded,
      commonsUploads: stats.commonsUploads,
    }));

    if (wikiSourceRows.length > 0) {
      await this.prisma.dailyWikiSourceStat.createMany({ data: wikiSourceRows });
    }

    await this.prisma.articleDailyStat.deleteMany({
      where: { date: dayStart },
    });

    const articleIds = Array.from(new Set(dailyPageviews.map((item) => item.articleId)));
    if (articleIds.length > 0) {
      const articles = await this.prisma.article.findMany({
        where: { id: { in: articleIds } },
        select: { id: true, characterSum: true, referencesCount: true },
      });

      const articleMap = new Map(
        articles.map((article) => [
          article.id,
          { characterSum: article.characterSum, referencesCount: article.referencesCount },
        ]),
      );

      const articleRows = dailyPageviews.map((item) => {
        const details = articleMap.get(item.articleId);
        return {
          date: dayStart,
          articleId: item.articleId,
          pageviews: item.views,
          characterSum: details?.characterSum ?? 0,
          referencesCount: details?.referencesCount ?? 0,
        };
      });

      if (articleRows.length > 0) {
        await this.prisma.articleDailyStat.createMany({ data: articleRows });
      }
    }
  }

  async runHistoryBackfill(startDate: Date, endDate: Date, jobId: string) {
    const start = toUtcDate(startDate);
    const end = toUtcDate(endDate);
    const total = Math.max(
      0,
      Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1,
    );
    const job = await this.prisma.syncJob.findUnique({
      where: { id: jobId },
      select: { metadata: true },
    });
    const raw =
      job?.metadata && typeof job.metadata === "object" && !Array.isArray(job.metadata)
        ? (job.metadata as Record<string, unknown>)
        : {};
    let processed = Math.max(0, Math.min(total, Number(raw.processed ?? 0)));

    const checkpoint = async (stage: string) => {
      await this.prisma.syncJob.update({
        where: { id: jobId },
        data: {
          metadata: {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            total,
            processed,
            stage,
          },
        },
      });
    };

    await checkpoint(`Backfilling snapshots (${processed}/${total} days)`);
    for (let offset = processed; offset < total; offset += 1) {
      await this.recordDailySnapshot(addUtcDays(start, offset));
      processed = offset + 1;
      await checkpoint(`Backfilling snapshots (${processed}/${total} days)`);
    }
    return { total, processed };
  }

  async backfillMissingDailySnapshots() {
    const earliest = await this.getEarliestActivityDate();
    if (!earliest) {
      return;
    }

    const latest = await this.prisma.dailyStat.findFirst({
      orderBy: { date: "desc" },
      select: { date: true },
    });

    const startDate = latest ? addUtcDays(latest.date, 1) : earliest;
    const yesterday = addUtcDays(toUtcDate(new Date()), -1);

    if (startDate > yesterday) {
      return;
    }

    await this.recordDailySnapshots(startDate, yesterday);
  }

  /** Reconcile snapshots that may have been written before upstream sync finished. */
  async refreshRecentDailySnapshots(days = 35) {
    const yesterday = addUtcDays(toUtcDate(new Date()), -1);
    const start = addUtcDays(yesterday, -(Math.max(1, days) - 1));
    await this.recordDailySnapshots(start, yesterday);
  }

  private async getEarliestActivityDate() {
    const [firstContribution, firstPageview, firstUpload, firstArticle, firstArticleFallback] =
      await Promise.all([
        this.prisma.contribution.findFirst({
          orderBy: { editTimestamp: "asc" },
          select: { editTimestamp: true },
        }),
        this.prisma.pageview.findFirst({
          orderBy: { date: "asc" },
          select: { date: true },
        }),
        this.prisma.commonsUpload.findFirst({
          orderBy: { uploadedAt: "asc" },
          select: { uploadedAt: true },
        }),
        this.prisma.article.findFirst({
          where: { articleCreatedAt: { not: null } },
          orderBy: { articleCreatedAt: "asc" },
          select: { articleCreatedAt: true },
        }),
        this.prisma.article.findFirst({
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        }),
      ]);

    const dates = [
      firstContribution?.editTimestamp,
      firstPageview?.date,
      firstUpload?.uploadedAt,
      firstArticle?.articleCreatedAt ?? undefined,
      firstArticleFallback?.createdAt,
    ].filter((value): value is Date => Boolean(value));

    if (dates.length === 0) {
      return null;
    }

    const earliest = dates.reduce((min, value) => (value < min ? value : min));
    return toUtcDate(earliest);
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

  async getTimeSeries(
    filters: StatsFilter = {},
    granularity: Granularity = "daily",
  ): Promise<TimeSeriesPoint[]> {
    const contributionWhere = this.buildContributionWhere(filters);
    const contributions = await this.prisma.contribution.findMany({
      where: contributionWhere,
      select: {
        editTimestamp: true,
        wordsAdded: true,
        isCreation: true,
      },
    });

    const seriesMap = new Map<string, TimeSeriesPoint>();

    const ensurePoint = (date: string) => {
      if (!seriesMap.has(date)) {
        seriesMap.set(date, {
          date,
          edits: 0,
          wordsAdded: 0,
          pageviews: 0,
          articlesCreated: 0,
        });
      }
      return seriesMap.get(date)!;
    };

    for (const contribution of contributions) {
      const dateKey = bucketDate(contribution.editTimestamp, granularity);
      const point = ensurePoint(dateKey);
      point.edits += 1;
      point.wordsAdded += contribution.wordsAdded;
      if (contribution.isCreation) {
        point.articlesCreated += 1;
      }
    }

    const pageviewType = this.resolveTimeSeriesPageviewType(filters);

    if (pageviewType === "DAILY") {
      const pageviews = await this.prisma.pageview.findMany({
        where: this.buildPageviewWhere(filters, pageviewType),
        select: { date: true, views: true },
      });

      for (const pageview of pageviews) {
        const dateKey = bucketDate(pageview.date, granularity);
        const point = ensurePoint(dateKey);
        point.pageviews += pageview.views;
      }
    } else {
      const pageviews = await this.prisma.pageview.findMany({
        where: this.buildPageviewWhere(filters, pageviewType),
        select: { articleId: true, date: true, cumulativeViews: true, views: true },
      });

      const bucketed = new Map<string, Map<string, { date: Date; value: number }>>();

      for (const pageview of pageviews) {
        const dateKey = bucketDate(pageview.date, granularity);
        const value = pageview.cumulativeViews ?? pageview.views;

        if (value == null) {
          continue;
        }

        let articleMap = bucketed.get(dateKey);
        if (!articleMap) {
          articleMap = new Map();
          bucketed.set(dateKey, articleMap);
        }

        const existing = articleMap.get(pageview.articleId);
        if (!existing || pageview.date > existing.date) {
          articleMap.set(pageview.articleId, { date: pageview.date, value });
        }
      }

      for (const [dateKey, articleMap] of bucketed.entries()) {
        const point = ensurePoint(dateKey);
        let total = 0;
        for (const entry of articleMap.values()) {
          total += entry.value;
        }
        point.pageviews = total;
      }
    }

    return Array.from(seriesMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  private resolvePageviewTypes(filters: StatsFilter): PageviewType[] {
    if (filters.source === "MEDIAWIKI") {
      return ["DAILY"];
    }

    if (filters.source === "OUTREACH_DASHBOARD") {
      return ["CUMULATIVE"];
    }

    return ["DAILY", "CUMULATIVE"];
  }

  private resolveTimeSeriesPageviewType(filters: StatsFilter): PageviewType {
    if (filters.source === "OUTREACH_DASHBOARD") {
      return "CUMULATIVE";
    }

    return "DAILY";
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
    const pageviewTypes = this.resolvePageviewTypes(filters);
    let total = 0;

    if (pageviewTypes.includes("DAILY")) {
      const daily = await this.prisma.pageview.aggregate({
        where: this.buildPageviewWhere(filters, "DAILY"),
        _sum: { views: true },
      });
      total += daily._sum.views ?? 0;
    }

    if (pageviewTypes.includes("CUMULATIVE")) {
      const snapshots = await this.getLatestCumulativePageviews(filters);
      for (const snapshot of snapshots) {
        total += snapshot.cumulativeViews ?? snapshot.views ?? 0;
      }
    }

    return total;
  }

  private async getPageviewsByWikiProject(filters: StatsFilter): Promise<Map<string, number>> {
    const totals = new Map<string, number>();
    const pageviewTypes = this.resolvePageviewTypes(filters);

    if (pageviewTypes.includes("DAILY")) {
      const pageviews = await this.prisma.pageview.findMany({
        where: this.buildPageviewWhere(filters, "DAILY"),
        select: { views: true, article: { select: { wikiProject: true } } },
      });

      for (const pageview of pageviews) {
        const project = pageview.article.wikiProject;
        totals.set(project, (totals.get(project) ?? 0) + pageview.views);
      }
    }

    if (pageviewTypes.includes("CUMULATIVE")) {
      const snapshots = await this.getLatestCumulativePageviews(filters);
      for (const snapshot of snapshots) {
        const project = snapshot.article.wikiProject;
        const value = snapshot.cumulativeViews ?? snapshot.views ?? 0;
        totals.set(project, (totals.get(project) ?? 0) + value);
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
      articleWhere.createdByEditorId = filters.editorId ?? { not: null };
    } else {
      articleWhere.isNewArticle = true;
      if (filters.editorId) {
        articleWhere.editors = { some: { editorId: filters.editorId, isAuthor: true } };
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
    for (let month = 1; month <= 12; month++) {
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));
      const [contributions, created, dailyViews, historicalViews, commonsUploads] =
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
          this.prisma.pageview.groupBy({
            by: ["articleId"],
            where: {
              date: { gte: start, lt: end },
              type: "DAILY",
              agentType: "ALL_AGENTS",
              article: articleWhere,
            },
            _sum: { views: true },
          }),
          this.prisma.historicalPageview.groupBy({
            by: ["articleId"],
            where: {
              periodStart: { gte: start, lt: end },
              granularity: "MONTHLY",
              agentType: "ALL_AGENTS",
              status: "SUCCESS",
              article: articleWhere,
            },
            _sum: { views: true },
          }),
          this.prisma.commonsUpload.count({ where: { uploadedAt: { gte: start, lt: end } } }),
        ]);
      const eligibleContributions = contributions.filter((row) => {
        const enrolledAt = enrolledAtByEditor.get(row.editorId);
        return !enrolledAt || row.editTimestamp >= enrolledAt;
      });
      const editors = new Set(eligibleContributions.map((row) => row.editorId));
      const editedArticles = new Set(eligibleContributions.map((row) => row.articleId));
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
      const pageviews = historicalByArticle.size || dailyByArticle.size ? pageviewTotal : null;
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
    const series = await this.getDailyHistory({
      startDate,
      endDate,
      wikiProject: filters?.wikiProject,
      source: filters?.source,
    });

    return series.map((row) => ({
      period: row.date.toISOString().slice(0, 10),
      edits: row.edits,
      wordsAdded: row.wordsAdded,
      pageviews: row.pageviews,
      articlesCreated: row.articlesCreated,
      articlesEdited: row.articlesEdited,
      editors: row.editors,
      referencesAdded: row.referencesAdded,
      commonsUploads: row.commonsUploads,
    }));
  }

  async getImpactReport(year: number, topLimit = 10, includeMonthly = false) {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
    const [articles, contributions, pageviewGroups, historicalGroups, commonsGroups, enrolledAtByEditor] =
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
        this.prisma.pageview.groupBy({
          by: ["articleId"],
          where: { date: { gte: start, lt: end }, type: "DAILY", agentType: "ALL_AGENTS" },
          _sum: { views: true },
        }),
        this.prisma.historicalPageview.groupBy({
          by: ["articleId"],
          where: {
            periodStart: { gte: start, lt: end },
            granularity: "MONTHLY",
            agentType: "ALL_AGENTS",
            status: "SUCCESS",
          },
          _sum: { views: true },
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
    // Choose pageview source per article. A global historical fallback silently
    // drops daily coverage for projects/articles without historical rows.
    const historicalByArticle = new Map(
      historicalGroups.map((row) => [row.articleId, row._sum.views ?? 0]),
    );
    const dailyByArticle = new Map(
      pageviewGroups.map((row) => [row.articleId, row._sum.views ?? 0]),
    );
    const pageviewsByArticle = new Map<string, number>();
    for (const articleId of new Set([...historicalByArticle.keys(), ...dailyByArticle.keys()])) {
      pageviewsByArticle.set(
        articleId,
        historicalByArticle.has(articleId)
          ? historicalByArticle.get(articleId)!
          : dailyByArticle.get(articleId)!,
      );
    }
    const rawPageviewGroups =
      pageviewGroups.length && historicalByArticle.size === 0 ? pageviewGroups : historicalGroups;
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
      pageviews: rawPageviewGroups.length
        ? Array.from(pageviewsByArticle.values()).reduce((sum, value) => sum + value, 0)
        : null,
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
        pageviews: historicalByArticle.size
          ? "Historical Wikimedia MONTHLY/ALL_AGENTS rows; DAILY fallback only for articles without historical coverage"
          : "Wikimedia DAILY/ALL_AGENTS rows",
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
    const [dailyViewRows, historicalViewRows] = await Promise.all([
      this.prisma.pageview.groupBy({
        by: ["articleId"],
        where: {
          date: { gte: startOfMonth, lt: nextMonth },
          type: "DAILY",
          agentType: "ALL_AGENTS",
        },
        _sum: { views: true },
      }),
      this.prisma.historicalPageview.groupBy({
        by: ["articleId"],
        where: {
          periodStart: { gte: startOfMonth, lt: nextMonth },
          granularity: "MONTHLY",
          agentType: "ALL_AGENTS",
          status: "SUCCESS",
        },
        _sum: { views: true },
      }),
    ]);
    const historicalByArticle = new Map(
      historicalViewRows.map((row) => [row.articleId, row._sum.views ?? 0]),
    );
    const dailyByArticle = new Map(
      dailyViewRows.map((row) => [row.articleId, row._sum.views ?? 0]),
    );
    const selectedByArticle = new Map<string, number>();
    for (const articleId of new Set([...historicalByArticle.keys(), ...dailyByArticle.keys()])) {
      selectedByArticle.set(
        articleId,
        historicalByArticle.has(articleId)
          ? historicalByArticle.get(articleId)!
          : dailyByArticle.get(articleId)!,
      );
    }
    const viewArticles = await this.prisma.article.findMany({
      where: {
        id: { in: Array.from(selectedByArticle.keys()) },
        ...(filters?.wikiProject ? { wikiProject: filters.wikiProject } : {}),
      },
      select: { id: true, wikiProject: true },
    });
    const viewProjectByArticle = new Map(
      viewArticles.map((article) => [article.id, article.wikiProject]),
    );
    const pageviewsByWiki = new Map<string, number>();
    for (const [articleId, views] of selectedByArticle) {
      const project = viewProjectByArticle.get(articleId);
      if (project) pageviewsByWiki.set(project, (pageviewsByWiki.get(project) ?? 0) + views);
    }
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
    const grouped = await this.prisma.articleDailyStat.groupBy({
      by: ["articleId"],
      where: { date: { gte: startDate, lt: endDate } },
      _sum: { pageviews: true },
    });
    const ranked = grouped
      .map((row) => ({ articleId: row.articleId, totalPageviews: row._sum.pageviews ?? 0 }))
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
