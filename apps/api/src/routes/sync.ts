import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { prisma } from "@repo/db";
import { WikimediaClient } from "@repo/utils";
import { TriggerSyncSchema, OutreachSyncSchema } from "../schemas";
import { SyncService } from "../services";
import { OutreachSyncService } from "../services/outreach-sync.service";

const wikimediaClient = new WikimediaClient({
  baseUrl: "https://en.wikipedia.org",
});
const syncService = new SyncService(prisma, wikimediaClient);

const outreachSyncService = new OutreachSyncService(prisma, {
  baseUrl: "https://outreachdashboard.wmflabs.org",
});

export const syncRoutes = new Hono();

syncRoutes.post("/trigger", async (c) => {
  const body = TriggerSyncSchema.parse(await c.req.json());
  const jobType = body.jobType ?? "full";

  const job = await syncService.createSyncJob(jobType);
  await syncService.startSyncJob(job.id);

  setTimeout(async () => {
    try {
      if (jobType === "contributions") {
        const contributionsSynced = await syncService.syncEditorContributions(
          undefined,
          undefined,
          job.id,
        );
        await syncService.completeSyncJob(job.id, { contributionsSynced });
        return;
      }
      if (jobType === "pageviews") {
        const pageviewsSynced = await syncService.syncArticlePageviews(
          undefined,
          undefined,
          job.id,
        );
        await syncService.completeSyncJob(job.id, { pageviewsSynced });
        return;
      }
      if (jobType === "commons") {
        const commonsUploadsSynced = await syncService.syncCommonsUploads(undefined, job.id);
        await syncService.completeSyncJob(job.id, { commonsUploadsSynced });
        return;
      }

      await syncService.runFullSync(job.id);
    } catch (error) {
      await syncService.failSyncJob(job.id, error);
    }
  }, 0);

  return c.json({ success: true, data: job }, 202);
});

syncRoutes.get("/status", async (c) => {
  const latest = await prisma.syncJob.findFirst({
    orderBy: { createdAt: "desc" },
  });

  return c.json({ success: true, data: latest });
});

syncRoutes.get("/history", async (c) => {
  const limit = Number(c.req.query("limit") ?? 10);
  const jobType = c.req.query("jobType");

  const history = await prisma.syncJob.findMany({
    where: jobType ? { jobType } : {},
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return c.json({ success: true, data: history });
});

/**
 * POST /api/sync/jobs/:id/cancel
 * Cancel a running sync job
 * Returns: { success: boolean, data: { id, status } }
 * Status: 200 OK, 404 Not Found, 400 Bad Request
 */
syncRoutes.post("/jobs/:id/cancel", async (c) => {
  const jobId = c.req.param("id");

  // Find the job
  const job = await prisma.syncJob.findUnique({
    where: { id: jobId },
  });

  // Job not found
  if (!job) {
    return c.json(
      {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Job not found",
        },
      },
      404,
    );
  }

  // Job is not running - can't cancel
  if (job.status !== "running") {
    return c.json(
      {
        success: false,
        error: {
          code: "BAD_REQUEST",
          message: "Job is not running",
        },
      },
      400,
    );
  }

  await prisma.syncJob.update({
    where: { id: jobId },
    data: {
      status: "cancelled",
      completedAt: new Date(),
    },
  });

  return c.json({
    success: true,
    data: {
      id: jobId,
      status: "cancelled",
    },
  });
});

/**
 * POST /api/sync/jobs/:id/retry
 * Retry a failed or cancelled sync job
 * Returns: { success: true, data: { newJobId } } (200)
 *          { success: false, error: { code, message } } (404 or 400)
 * Status: 200 OK, 404 Not Found, 400 Bad Request
 */
syncRoutes.post("/jobs/:id/retry", async (c) => {
  const jobId = c.req.param("id");

  // Find the job
  const job = await prisma.syncJob.findUnique({
    where: { id: jobId },
  });

  // Job not found
  if (!job) {
    return c.json(
      {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Job not found",
        },
      },
      404,
    );
  }

  // Job is not retriable (only failed or cancelled are retriable)
  if (!["failed", "cancelled"].includes(job.status)) {
    return c.json(
      {
        success: false,
        error: {
          code: "BAD_REQUEST",
          message: "Job is not in a retriable state",
        },
      },
      400,
    );
  }

  // Create new job with same jobType
  const newJob = await syncService.createSyncJob(job.jobType);
  await syncService.startSyncJob(newJob.id);

  // Trigger sync async based on jobType
  setTimeout(async () => {
    try {
      if (job.jobType === "contributions") {
        const contributionsSynced = await syncService.syncEditorContributions(
          undefined,
          undefined,
          newJob.id,
        );
        await syncService.completeSyncJob(newJob.id, { contributionsSynced });
        return;
      }
      if (job.jobType === "pageviews") {
        const pageviewsSynced = await syncService.syncArticlePageviews(
          undefined,
          undefined,
          newJob.id,
        );
        await syncService.completeSyncJob(newJob.id, { pageviewsSynced });
        return;
      }
      if (job.jobType === "commons") {
        const commonsUploadsSynced = await syncService.syncCommonsUploads(undefined, newJob.id);
        await syncService.completeSyncJob(newJob.id, { commonsUploadsSynced });
        return;
      }

      await syncService.runFullSync();
    } catch (error) {
      await syncService.failSyncJob(newJob.id, error);
    }
  }, 0);

  return c.json(
    {
      success: true,
      data: {
        newJobId: newJob.id,
      },
    },
    200,
  );
});

syncRoutes.delete("/jobs/:id", async (c) => {
  const jobId = c.req.param("id");

  const job = await prisma.syncJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    return c.json(
      {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Job not found",
        },
      },
      404,
    );
  }

  if (job.status === "running") {
    return c.json(
      {
        success: false,
        error: {
          code: "BAD_REQUEST",
          message: "Cannot delete a running job. Cancel it first.",
        },
      },
      400,
    );
  }

  await prisma.syncJob.delete({
    where: { id: jobId },
  });

  return c.json({
    success: true,
    data: { id: jobId },
  });
});

syncRoutes.post("/outreach", async (c) => {
  try {
    const body = OutreachSyncSchema.parse(await c.req.json());

    setTimeout(async () => {
      try {
        await outreachSyncService.syncEditorsFromDashboard(body.school, body.slug);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Outreach sync failed:", errorMessage);
      }
    }, 0);

    return c.json(
      {
        success: true,
        data: {
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

/**
 * GET /api/sync/stream
 * Server-Sent Events (SSE) endpoint for real-time job status updates
 * Streams running jobs and recently completed jobs (last 5 minutes)
 * Returns: text/event-stream with job-update events
 */
syncRoutes.get("/stream", async (c) => {
  return streamSSE(c, async (stream) => {
    stream.onAbort(() => {});

    while (true) {
      try {
        // Get running jobs
        const runningJobs = await prisma.syncJob.findMany({
          where: { status: "running" },
          orderBy: { startedAt: "desc" },
        });

        // Get recently completed/failed/cancelled jobs (last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const recentJobs = await prisma.syncJob.findMany({
          where: {
            status: { in: ["completed", "failed", "cancelled"] },
            completedAt: { gte: fiveMinutesAgo },
          },
          orderBy: { completedAt: "desc" },
          take: 10,
        });

        // Combine and send
        const jobs = [...runningJobs, ...recentJobs];

        await stream.writeSSE({
          data: JSON.stringify(jobs),
          event: "job-update",
          id: String(Date.now()),
        });

        // Wait 2 seconds before next update
        await stream.sleep(2000);
      } catch (error) {
        console.error("Error streaming job updates:", error);
        // Continue streaming even if there's an error
        await stream.sleep(2000);
      }
    }
  });
});
