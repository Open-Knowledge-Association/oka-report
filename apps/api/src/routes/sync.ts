import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { prisma } from "@repo/db";
import { Prisma } from "@repo/db/generated/prisma/client";
import { WikimediaClient } from "@repo/utils";
import { OutreachSyncSchema, TriggerSyncSchema } from "../schemas";
import { SyncService } from "../services";

const wikimediaClient = new WikimediaClient({
  baseUrl: "https://en.wikipedia.org",
});
const syncService = new SyncService(prisma, wikimediaClient);

export const syncRoutes = new Hono();

syncRoutes.post("/trigger", async (c) => {
  const body = TriggerSyncSchema.parse(await c.req.json());
  const jobType = body.jobType ?? "full";
  const syncMode = body.syncMode ?? "manual_full";

  // Full bootstrap is owned by the durable bootstrap worker. Do not run a
  // second full sync via an API timer, which would be lost on restart.
  if (jobType === "full") {
    return c.json(
      {
        success: false,
        error: {
          code: "FULL_SYNC_WORKER_ONLY",
          message: "Use the bootstrap worker for full sync; API timers are disabled",
        },
      },
      409,
    );
  }

  const activeJob = await syncService.findActiveJob(jobType);
  if (activeJob) {
    return c.json(
      {
        success: false,
        error: {
          code: "CONFLICT",
          message: "Job already running",
        },
      },
      409,
    );
  }

  const job = await syncService.createSyncJob(jobType, undefined, { mode: syncMode });
  await syncService.startSyncJob(job.id);

  // Child/manual jobs are durable queue entries. The worker owns execution;
  // never run them in the API process where a restart loses the task.
  return c.json({ success: true, data: job }, 202);
});

syncRoutes.get("/status", async (c) => {
  const latest = await prisma.syncJob.findFirst({
    orderBy: { createdAt: "desc" },
  });

  return c.json({ success: true, data: latest });
});

syncRoutes.get("/history", async (c) => {
  const rawLimit = Number(c.req.query("limit") ?? 10);
  const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 10;
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

  await syncService.cancelSyncJob(jobId);

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

  const activeJob = await syncService.findActiveJob(job.jobType);
  if (activeJob) {
    return c.json(
      {
        success: false,
        error: {
          code: "CONFLICT",
          message: "Job already running",
        },
      },
      409,
    );
  }

  await prisma.syncJob.update({
    where: { id: job.id },
    data: {
      status: "pending",
      startedAt: null,
      completedAt: null,
      error: null,
      metadata: Prisma.JsonNull,
    },
  });

  if (job.jobType === "full") {
    await prisma.syncJob.deleteMany({ where: { parentJobId: job.id } });
  }

  await syncService.startSyncJob(job.id);

  const originalMetadata =
    job.metadata && typeof job.metadata === "object" && !Array.isArray(job.metadata)
      ? (job.metadata as Record<string, unknown>)
      : {};
  await prisma.syncJob.update({
    where: { id: job.id },
    data: {
      metadata: {
        ...originalMetadata,
        mode: typeof originalMetadata.mode === "string" ? originalMetadata.mode : "manual_full",
      } as any,
    },
  });

  return c.json(
    {
      success: true,
      data: {
        newJobId: job.id,
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

    const job = await prisma.syncJob.create({
      data: {
        jobType: "editors",
        status: "pending",
        metadata: { school: body.school, slug: body.slug },
      },
    });

    return c.json(
      {
        success: true,
        data: {
          jobId: job.id,
          status: "pending",
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
    let failureCount = 0;

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

        failureCount = 0;

        // Wait 2 seconds before next update
        await stream.sleep(2000);
      } catch (error) {
        failureCount += 1;
        const message = error instanceof Error ? error.message : String(error);
        console.error("Error streaming job updates:", message);
        const backoff = Math.min(2000 * Math.pow(2, failureCount - 1), 30000);
        // Continue streaming even if there's an error
        await stream.sleep(backoff);
      }
    }
  });
});
