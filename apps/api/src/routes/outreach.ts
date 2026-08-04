import { Hono } from "hono";
import { prisma } from "@repo/db";
import { OutreachDashboardClient } from "@repo/utils/src/outreach-dashboard";
import { WikimediaClient } from "@repo/utils";
import {
  OutreachSyncSchema,
  OutreachArticleStatsResponseSchema,
  OutreachArticlesQuerySchema,
} from "../schemas";

// Initialize Outreach Dashboard client
const dashboardClient = new OutreachDashboardClient({
  baseUrl: "https://outreachdashboard.wmflabs.org",
});

export const outreachRoutes = new Hono();

const normalizeAuthorUsername = (value: string) =>
  value.normalize("NFC").replace(/\s+/g, "_").toLowerCase();

const parseWikiProject = (wikiProject: string) => {
  const match = wikiProject.match(/^(.+?)\.(.+?)\.org$/);
  if (match) {
    return { language: match[1], project: match[2] };
  }
  return { language: "en", project: "wikipedia" };
};

/**
 * GET /api/outreach/course
 * Fetch course metadata from Outreach Dashboard
 * Query params: school, slug
 * Returns: { success: boolean, data: CourseData }
 */
outreachRoutes.get("/course", async (c) => {
  try {
    const school = c.req.query("school");
    const slug = c.req.query("slug");

    if (!school || !slug) {
      return c.json(
        {
          success: false,
          error: "Missing required query parameters: school, slug",
        },
        400,
      );
    }

    const courseData = await dashboardClient.getCourse(school, slug);

    return c.json(
      {
        success: true,
        data: courseData,
      },
      200,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching course:", message);

    return c.json(
      {
        success: false,
        error: "Failed to trigger sync",
        details: message,
      },
      500,
    );
  }
});

/**
 * POST /api/outreach/backfill-authors
 * Backfill isAuthor field for ArticleEditor records (filtered by OUTREACH_DASHBOARD source)
 * Query params: limit (default 100, max 500)
 * Returns: { success: boolean, data: { total, processed, authorsFound } }
 */
outreachRoutes.post("/backfill-authors", async (c) => {
  try {
    const limitParam = c.req.query("limit");
    let limit = 100;
    if (limitParam) {
      const parsedLimit = Number(limitParam);
      if (!Number.isInteger(parsedLimit)) {
        return c.json({ success: false, error: "limit must be an integer" }, 400);
      }
      limit = Math.min(Math.max(parsedLimit, 1), 500);
    }

    const recordsToProcess = await prisma.articleEditor.findMany({
      where: {
        isAuthor: false,
        article: {
          source: "OUTREACH_DASHBOARD",
        },
      },
      take: limit,
      include: {
        article: true,
        editor: true,
      },
    });

    const total = recordsToProcess.length;
    let processed = 0;
    let authorsFound = 0;
    const errors: Array<{ articleTitle: string; editorUsername: string; error: string }> = [];

    for (const record of recordsToProcess) {
      try {
        // Parse wikiProject format: "en.wikipedia.org" -> extract language and project
        const wikiProjectParts = record.article.wikiProject.split(".");
        const language = wikiProjectParts[0];
        const project = wikiProjectParts[1];
        const wikiBaseUrl = `https://${language}.${project}.org`;
        const wikimediaClient = new WikimediaClient({
          baseUrl: wikiBaseUrl,
          rateLimiterOptions: { delayMs: 200 }, // 200ms delay = 5 req/sec
        });

        const articleInfo = await wikimediaClient.getArticleInfo(
          record.article.title,
          record.article.pageId ?? undefined,
        );

        if (articleInfo?.creator) {
          const normalizedCreator = normalizeAuthorUsername(articleInfo.creator);
          const normalizedEditor = normalizeAuthorUsername(record.editor.username);
          const isAuthor = normalizedCreator === normalizedEditor;

          await prisma.article.update({
            where: { id: record.article.id },
            data: {
              authorStatus: isAuthor ? "verified_tracked" : "verified_external",
              authorUsername: articleInfo.creator,
              authorVerifiedAt: new Date(),
              createdByEditorId: isAuthor ? record.editor.id : null,
            },
          });

          await prisma.articleEditor.update({
            where: { id: record.id },
            data: { isAuthor },
          });

          if (isAuthor) {
            await prisma.articleEditor.update({
              where: { id: record.id },
              data: { isAuthor: true },
            });

            await prisma.article.update({
              where: { id: record.article.id },
              data: { createdByEditorId: record.editor.id },
            });

            authorsFound++;
          }
        } else {
          await prisma.article.update({
            where: { id: record.article.id },
            data: { authorStatus: "unavailable", authorVerifiedAt: new Date() },
          });
        }

        processed++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({
          articleTitle: record.article.title,
          editorUsername: record.editor.username,
          error: errorMessage,
        });
        processed++;
        console.error(
          `Failed to process article "${record.article.title}" for editor "${record.editor.username}":`,
          errorMessage,
        );
      }
    }

    return c.json(
      {
        success: true,
        data: {
          total,
          processed,
          authorsFound,
          errors: errors.length > 0 ? errors : undefined,
        },
      },
      200,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error backfilling authors:", message);

    return c.json(
      {
        success: false,
        error: "Failed to backfill authors",
        details: message,
      },
      500,
    );
  }
});

/**
 * GET /api/outreach/users
 * Fetch user data from Outreach Dashboard
 * Query params: school, slug
 * Returns: { success: boolean, data: UserData }
 */
outreachRoutes.get("/users", async (c) => {
  try {
    const school = c.req.query("school");
    const slug = c.req.query("slug");

    if (!school || !slug) {
      return c.json(
        {
          success: false,
          error: "Missing required query parameters: school, slug",
        },
        400,
      );
    }

    const userData = await dashboardClient.getUsers(school, slug);

    return c.json(
      {
        success: true,
        data: userData,
      },
      200,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching users:", message);

    return c.json(
      {
        success: false,
        error: "Failed to fetch user data",
        details: message,
      },
      500,
    );
  }
});

/**
 * GET /api/outreach/articles
 * Fetch article data from Outreach Dashboard
 * Query params: school, slug
 * Returns: { success: boolean, data: ArticleData }
 */
outreachRoutes.get("/articles", async (c) => {
  try {
    const school = c.req.query("school");
    const slug = c.req.query("slug");

    if (!school || !slug) {
      return c.json(
        {
          success: false,
          error: "Missing required query parameters: school, slug",
        },
        400,
      );
    }

    const articleData = await dashboardClient.getArticles(school, slug);

    return c.json(
      {
        success: true,
        data: articleData,
      },
      200,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching articles:", message);

    return c.json(
      {
        success: false,
        error: "Failed to fetch articles data",
        details: message,
      },
      500,
    );
  }
});

/**
 * POST /api/outreach/articles/sync
 * Trigger sync of articles from Outreach Dashboard
 * Body: { school, slug }
 * Returns: { success: boolean, data: { jobId, status } }
 * Status: 202 Accepted
 */
outreachRoutes.post("/articles/sync", async (c) => {
  try {
    const body = OutreachSyncSchema.parse(await c.req.json());

    // Check if a sync is already running
    const runningSync = await prisma.syncJob.findFirst({
      where: {
        jobType: "outreach_articles",
        status: { in: ["running", "pending"] },
      },
    });

    if (runningSync) {
      throw new Error("Sync already in progress");
    }

    // Create sync job
    const job = await prisma.syncJob.create({
      data: {
        jobType: "outreach_articles",
        status: "pending",
        metadata: { school: body.school, slug: body.slug },
      },
    });

    // The durable worker claims and executes this pending job.
    // Do not run the sync in the API process: a restart would lose the task.
    return c.json(
      {
        success: true,
        data: {
          jobId: job.id,
          status: "accepted",
        },
      },
      202,
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return c.json(
        {
          success: false,
          error: "Invalid request body",
        },
        400,
      );
    }

    if (error instanceof Error && error.name === "ZodError") {
      return c.json(
        {
          success: false,
          error: "Validation error",
          details: error.message,
        },
        400,
      );
    }

    if (error instanceof Error && error.message?.includes("Sync already in progress")) {
      return c.json(
        {
          success: false,
          error: error.message,
        },
        409,
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error("Error triggering outreach articles sync:", message);

    return c.json(
      {
        success: false,
        error: "Failed to trigger sync",
        details: message,
      },
      500,
    );
  }
});

/**
 * GET /api/outreach/articles/db
 * Fetch articles from database with pagination, search, and wiki filtering
 * Query params: page (default 1), limit (default 50), search (optional), wiki (optional, format: "en.wikipedia")
 * Returns: { success: boolean, data: { articles: [...], pagination: {...} } }
 */
outreachRoutes.get("/articles/db", async (c) => {
  try {
    c.header("Deprecation", "true");
    c.header("Link", '</api/articles>; rel="successor-version"');

    const query = OutreachArticlesQuerySchema.parse(c.req.query());

    const offset = (query.page - 1) * query.limit;

    // Build dynamic where clause based on query parameters
    const where: any = {
      source: "OUTREACH_DASHBOARD",
      ...(query.search ? { title: { contains: query.search, mode: "insensitive" } } : {}),
      ...(query.wiki
        ? (() => {
            const [language, project] = query.wiki.split(".");
            if (language && project) {
              return { wikiProject: `${language}.${project}.org` };
            }
            return {};
          })()
        : {}),
    };

    const total = await prisma.article.count({ where });

    const articles = await prisma.article.findMany({
      where,
      skip: offset,
      take: query.limit,
      include: {
        pageviews: { where: { type: "CUMULATIVE" }, orderBy: { date: "desc" }, take: 1 },
        editors: {
          include: {
            editor: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const totalPages = Math.ceil(total / query.limit);

    const normalizedArticles = articles.map((article) => {
      const { language, project } = parseWikiProject(article.wikiProject);
      return { ...article, language, project };
    });

    return c.json(
      {
        success: true,
        data: {
          articles: normalizedArticles,
          pagination: {
            total,
            page: query.page,
            limit: query.limit,
            totalPages,
          },
        },
      },
      200,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching articles from database:", message);

    return c.json(
      {
        success: false,
        error: "Failed to fetch articles",
        details: message,
      },
      500,
    );
  }
});

/**
 * GET /api/outreach/articles/stats
 * Get global aggregation stats for all Outreach articles
 * Returns: { success: boolean, data: { totalArticles, totalPageviews, uniqueWikis, wikiStats } }
 */
outreachRoutes.get("/articles/stats", async (c) => {
  try {
    c.header("Deprecation", "true");
    c.header("Link", '</api/articles>; rel="successor-version"');

    // Total article count
    const totalArticles = await prisma.article.count({
      where: { source: "OUTREACH_DASHBOARD" },
    });

    // Get all articles with their latest CUMULATIVE pageview snapshot
    const articles = await prisma.article.findMany({
      where: { source: "OUTREACH_DASHBOARD" },
      include: {
        pageviews: {
          where: { type: "CUMULATIVE" },
          orderBy: { date: "desc" },
          take: 1,
        },
      },
    });

    // Calculate total pageviews from latest snapshots
    let totalPageviews = 0;
    for (const article of articles) {
      if (article.pageviews.length > 0 && article.pageviews[0].cumulativeViews) {
        totalPageviews += article.pageviews[0].cumulativeViews;
      }
    }

    // Group by wiki (using wikiProject field) to get stats
    const wikiMap = new Map<string, { count: number; pageviews: number }>();

    for (const article of articles) {
      const wikiKey = article.wikiProject;

      if (!wikiMap.has(wikiKey)) {
        wikiMap.set(wikiKey, { count: 0, pageviews: 0 });
      }

      const stats = wikiMap.get(wikiKey)!;
      stats.count += 1;

      if (article.pageviews.length > 0 && article.pageviews[0].cumulativeViews) {
        stats.pageviews += article.pageviews[0].cumulativeViews;
      }
    }

    // Convert map to array and sort by wiki name
    const wikiStats = Array.from(wikiMap.entries())
      .map(([wiki, stats]) => ({
        wiki,
        count: stats.count,
        pageviews: stats.pageviews,
      }))
      .sort((a, b) => a.wiki.localeCompare(b.wiki));

    // Validate response schema
    const responseData = OutreachArticleStatsResponseSchema.parse({
      totalArticles,
      totalPageviews,
      uniqueWikis: wikiMap.size,
      wikiStats,
    });

    return c.json(
      {
        success: true,
        data: responseData,
      },
      200,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching outreach articles stats:", message);

    return c.json(
      {
        success: false,
        error: "Failed to fetch statistics",
        details: message,
      },
      500,
    );
  }
});

/**
 * POST /api/sync/outreach
 * Trigger sync of editors from Outreach Dashboard
 * Body: { school, slug }
 * Returns: { success: boolean, data: { jobId, status } }
 * Status: 202 Accepted
 */
outreachRoutes.post("/sync", async (c) => {
  try {
    const body = OutreachSyncSchema.parse(await c.req.json());

    const runningSync = await prisma.syncJob.findFirst({
      where: {
        jobType: "editors",
        status: { in: ["running", "pending"] },
      },
    });

    if (runningSync) {
      return c.json(
        {
          success: false,
          error: "Sync already in progress",
        },
        409,
      );
    }

    // Queue only; the durable worker owns execution after the response returns.
    const job = await prisma.syncJob.create({
      data: {
        jobType: "editors",
        status: "pending",
        metadata: { school: body.school, slug: body.slug, mode: "manual_incremental" },
      },
    });

    return c.json(
      {
        success: true,
        data: {
          jobId: job.id,
          status: "accepted",
        },
      },
      202,
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return c.json(
        {
          success: false,
          error: "Invalid request body",
        },
        400,
      );
    }

    if (error instanceof Error && error.name === "ZodError") {
      return c.json(
        {
          success: false,
          error: "Validation error",
          details: error.message,
        },
        400,
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error("Error triggering outreach sync:", message);

    return c.json(
      {
        success: false,
        error: "Failed to trigger sync",
        details: message,
      },
      500,
    );
  }
});
