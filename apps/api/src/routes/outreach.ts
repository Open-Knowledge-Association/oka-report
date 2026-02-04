import { Hono } from "hono";
import { prisma } from "@repo/db";
import { OutreachDashboardClient } from "@repo/utils/src/outreach-dashboard";
import { OutreachSyncService } from "../services/outreach-sync.service";
import { OutreachSyncSchema } from "../schemas";

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
            metadata: result,
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
