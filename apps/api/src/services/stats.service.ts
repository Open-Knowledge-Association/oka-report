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

    const createdArticles = await this.prisma.article.findMany({
      where: {
        OR: [
          { articleCreatedAt: { gte: dayStart, lt: dayEnd } },
          { articleCreatedAt: null, createdAt: { gte: dayStart, lt: dayEnd } },
        ],
      },
      select: { id: true, referencesCount: true, wikiProject: true, source: true },
    });

    const articlesCreated = createdArticles.length;
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

    if (createdArticleSet.size > 0) {
      const createdArticleRefs = await this.prisma.article.findMany({
        where: { id: { in: Array.from(createdArticleSet) } },
        select: { id: true, referencesCount: true },
      });

      const refsByArticleId = new Map(
        createdArticleRefs.map((article) => [article.id, article.referencesCount ?? 0]),
      );

      for (const [editorId, stats] of editorStats.entries()) {
        let totalRefs = 0;
        for (const articleId of stats.createdArticles) {
          totalRefs += refsByArticleId.get(articleId) ?? 0;
        }
        stats.referencesAdded = totalRefs;
      }
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

    for (const [wikiProject, wikiStat] of wikiStats.entries()) {
      for (const upload of uploads) {
        if (wikiStat.editors.has(upload.editorId)) {
          wikiStat.commonsUploads += 1;
        }
      }
    }

    for (const [source, sourceStat] of sourceStats.entries()) {
      for (const upload of uploads) {
        if (sourceStat.editors.has(upload.editorId)) {
          sourceStat.commonsUploads += 1;
        }
      }
    }

    for (const [wikiSourceKey, wikiSourceStat] of wikiSourceStats.entries()) {
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
      where: { date: dayStart, type: "DAILY" },
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

    await this.prisma.editorDailyStat.deleteMany({
      where: { date: dayStart },
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
      await this.prisma.editorDailyStat.createMany({ data: editorRows });
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
      OR: [{ articleCreatedAt: range }, { articleCreatedAt: null, createdAt: range }],
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
}
