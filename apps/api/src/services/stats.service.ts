import type { Prisma, PrismaClient } from "@repo/db/generated/prisma/client";

export type StatsFilter = {
  startDate?: Date;
  endDate?: Date;
  wikiProject?: string;
  editorId?: string;
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

  async getOverallStats(filters: StatsFilter = {}): Promise<OverallStats> {
    const contributionWhere = this.buildContributionWhere(filters);
    const contributions = await this.prisma.contribution.findMany({
      where: contributionWhere,
      select: { wordsAdded: true, articleId: true, isCreation: true },
    });

    const edits = contributions.length;
    const wordsAdded = contributions.reduce(
      (total, item) => total + item.wordsAdded,
      0,
    );

    const createdArticles = new Set(
      contributions.filter((item) => item.isCreation).map((item) => item.articleId),
    );
    const modifiedArticles = new Set(contributions.map((item) => item.articleId));

    const pageviews = await this.prisma.pageview.aggregate({
      where: this.buildPageviewWhere(filters),
      _sum: { views: true },
    });

    const commonsUploads = await this.prisma.commonsUpload.count({
      where: this.buildCommonsWhere(filters),
    });

    return {
      edits,
      wordsAdded,
      pageviews: pageviews._sum.views ?? 0,
      articlesCreated: createdArticles.size,
      articlesModified: modifiedArticles.size,
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
    const createdByProject = new Map<string, Set<string>>();
    const modifiedByProject = new Map<string, Set<string>>();

    for (const contribution of contributions) {
      const project = contribution.article.wikiProject;
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
        createdByProject.set(project, new Set());
        modifiedByProject.set(project, new Set());
      }

      const stats = projectMap.get(project);
      if (!stats) continue;
      stats.edits += 1;
      stats.wordsAdded += contribution.wordsAdded;
      modifiedByProject.get(project)?.add(contribution.articleId);
      if (contribution.isCreation) {
        createdByProject.get(project)?.add(contribution.articleId);
      }
    }

    const pageviews = await this.prisma.pageview.findMany({
      where: this.buildPageviewWhere(filters),
      select: { views: true, article: { select: { wikiProject: true } } },
    });

    for (const pageview of pageviews) {
      const stats = projectMap.get(pageview.article.wikiProject);
      if (stats) {
        stats.pageviews += pageview.views;
      }
    }

    for (const [project, stats] of projectMap.entries()) {
      stats.articlesCreated = createdByProject.get(project)?.size ?? 0;
      stats.articlesModified = modifiedByProject.get(project)?.size ?? 0;
    }

    return Array.from(projectMap.values()).sort(
      (a, b) => b.wordsAdded - a.wordsAdded,
    );
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

    const pageviews = await this.prisma.pageview.findMany({
      where: this.buildPageviewWhere(filters),
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

    return Array.from(editorMap.values()).sort(
      (a, b) => b.wordsAdded - a.wordsAdded,
    );
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

    const pageviews = await this.prisma.pageview.findMany({
      where: this.buildPageviewWhere(filters),
      select: { date: true, views: true },
    });

    for (const pageview of pageviews) {
      const dateKey = bucketDate(pageview.date, granularity);
      const point = ensurePoint(dateKey);
      point.pageviews += pageview.views;
    }

    return Array.from(seriesMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
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
    if (filters.wikiProject) {
      where.article = { wikiProject: filters.wikiProject };
    }
    return where;
  }

  private buildPageviewWhere(filters: StatsFilter): Prisma.PageviewWhereInput {
    const where: Prisma.PageviewWhereInput = {
      article: {
        createdByEditorId: { not: null },
        ...(filters.editorId ? { createdByEditorId: filters.editorId } : {}),
        ...(filters.wikiProject ? { wikiProject: filters.wikiProject } : {}),
      },
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
