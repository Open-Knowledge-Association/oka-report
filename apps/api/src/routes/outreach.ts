import { Hono } from "hono";
import { prisma } from "@repo/db";
import { OutreachDashboardClient } from "@repo/utils/src/outreach-dashboard";
import { OutreachSyncService } from "../services/outreach-sync.service";
import {
  OutreachSyncSchema,
  OutreachArticleStatsResponseSchema,
  OutreachArticlesQuerySchema,
} from "../schemas";

// Initialize Outreach Dashboard client
const dashboardClient = new OutreachDashboardClient({
  baseUrl: "https://outreachdashboard.wmflabs.org",
});

const outreachSyncService = new OutreachSyncService(prisma, {
  baseUrl: "https://outreachdashboard.wmflabs.org",
});

export const outreachRoutes = new Hono();

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
        error: "Failed to fetch course data",
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
        status: "running",
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
      },
    });

    // Trigger async sync
    setTimeout(async () => {
      try {
        const result = await outreachSyncService.syncArticlesFromDashboard(body.school, body.slug);

        // Update job with results
        await prisma.syncJob.update({
          where: { id: job.id },
          data: {
            status: "completed",
            completedAt: new Date(),
            metadata: result,
          },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Outreach articles sync failed:", errorMessage);

        await prisma.syncJob.update({
          where: { id: job.id },
          data: {
            status: "failed",
            completedAt: new Date(),
            error: errorMessage,
          },
        });
      }
    }, 0);

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
    const query = OutreachArticlesQuerySchema.parse(c.req.query());

    const offset = (query.page - 1) * query.limit;

    // Build dynamic where clause based on query parameters
    const where: Parameters<typeof prisma.outreachArticle.findMany>[0]["where"] = {
      ...(query.search ? { title: { contains: query.search, mode: "insensitive" } } : {}),
      ...(query.wiki
        ? (() => {
            const [language, project] = query.wiki.split(".");
            return language && project ? { language, project } : {};
          })()
        : {}),
    };

    const total = await prisma.outreachArticle.count({ where });

    const articles = await prisma.outreachArticle.findMany({
      where,
      skip: offset,
      take: query.limit,
      include: {
        pageviews: true,
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

    return c.json(
      {
        success: true,
        data: {
          articles,
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
    // Total article count
    const totalArticles = await prisma.outreachArticle.count();

    // Get all articles with their latest pageview snapshot
    const articles = await prisma.outreachArticle.findMany({
      include: {
        pageviews: {
          orderBy: { snapshotDate: "desc" },
          take: 1,
        },
      },
    });

    // Calculate total pageviews from latest snapshots
    let totalPageviews = 0;
    for (const article of articles) {
      if (article.pageviews.length > 0) {
        totalPageviews += article.pageviews[0].cumulativeViews;
      }
    }

    // Group by wiki (language + project) to get stats
    const wikiMap = new Map<string, { count: number; pageviews: number }>();

    for (const article of articles) {
      const wikiKey = `${article.language}.${article.project}`;

      if (!wikiMap.has(wikiKey)) {
        wikiMap.set(wikiKey, { count: 0, pageviews: 0 });
      }

      const stats = wikiMap.get(wikiKey)!;
      stats.count += 1;

      if (article.pageviews.length > 0) {
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

    // Create sync job
    const job = await prisma.syncJob.create({
      data: {
        jobType: "editors",
        status: "pending",
      },
    });

    // Trigger async sync
    setTimeout(async () => {
      try {
        const result = await outreachSyncService.syncEditorsFromDashboard(body.school, body.slug);

        // Update job with results
        await prisma.syncJob.update({
          where: { id: job.id },
          data: {
            status: "completed",
            completedAt: new Date(),
            metadata: result as any,
          },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Outreach sync failed:", errorMessage);

        await prisma.syncJob.update({
          where: { id: job.id },
          data: {
            status: "failed",
            completedAt: new Date(),
            error: errorMessage,
          },
        });
      }
    }, 0);

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
