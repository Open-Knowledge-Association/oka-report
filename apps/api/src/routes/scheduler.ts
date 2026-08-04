import { Hono } from "hono";
import { prisma } from "@repo/db";
import { BootstrapService } from "../services/bootstrap.service";
import { HistoricalBackfillPlanner } from "../services/historical-backfill-planner.service";

const schedule = process.env.SYNC_SCHEDULE ?? "0 2 * * *";
const outreachSchool = process.env.OUTREACH_SCHOOL ?? "OKA";
const outreachSlug = process.env.OUTREACH_SLUG ?? "OKA";
const outreachSchedule = process.env.OUTREACH_ARTICLE_SYNC_SCHEDULE ?? "0 3 * * *";
const historicalSchedule = process.env.HISTORICAL_BACKFILL_SCHEDULE ?? "0 4 * * 0";

export const schedulerRoutes = new Hono();

const getSettingsMap = async () => {
  const settings = await prisma.schedulerSetting.findMany();
  return new Map(settings.map((item) => [item.id, item]));
};

schedulerRoutes.get("/", async (c) => {
  const bootstrapService = new BootstrapService(prisma);
  const bootstrapState = await bootstrapService.getState();
  const isBootstrapBlocked = !bootstrapState || bootstrapState.state !== "completed";

  const settings = await getSettingsMap();
  const getSetting = (id: string) => settings.get(id);
  return c.json({
    success: true,
    data: {
      timezone: "UTC",
      jobs: [
        {
          id: "full-sync",
          name: "Full Sync",
          type: "cron",
          schedule,
          enabled: getSetting("full-sync")?.enabled ?? true,
          disabledReason: getSetting("full-sync")?.disabledReason ?? null,
          bootstrapBlocked: isBootstrapBlocked,
          description: "Runs full sync (editors, articles, contributions, pageviews, commons).",
          triggers: [
            {
              method: "POST",
              path: "/api/sync/trigger",
              payload: { jobType: "full" },
            },
          ],
        },
        {
          id: "outreach-articles",
          name: "Outreach Articles Sync",
          type: "cron",
          schedule: outreachSchedule,
          enabled: getSetting("outreach-articles")?.enabled ?? true,
          disabledReason: getSetting("outreach-articles")?.disabledReason ?? null,
          bootstrapBlocked: isBootstrapBlocked,
          description: "Sync Outreach Dashboard articles.",
          params: {
            school: outreachSchool,
            slug: outreachSlug,
          },
          triggers: [
            {
              method: "POST",
              path: "/api/outreach/articles/sync",
              payload: { school: outreachSchool, slug: outreachSlug },
            },
          ],
        },
        {
          id: "historical-backfill",
          name: "Historical Data Backfill",
          type: "cron",
          schedule: historicalSchedule,
          enabled: getSetting("historical-backfill")?.enabled ?? true,
          disabledReason: getSetting("historical-backfill")?.disabledReason ?? null,
          bootstrapBlocked: isBootstrapBlocked,
          description:
            "Fills one incomplete year at a time, then rebuilds that year's daily snapshots.",
          triggers: [
            {
              method: "POST",
              path: "/api/scheduler/historical-backfill/run",
              payload: {},
            },
          ],
        },
        {
          id: "daily-stats",
          name: "Daily Stats Snapshot",
          type: "cron",
          schedule: "15 0 * * *",
          enabled: getSetting("daily-stats")?.enabled ?? true,
          disabledReason: getSetting("daily-stats")?.disabledReason ?? null,
          bootstrapBlocked: isBootstrapBlocked,
          description: "Records daily stats snapshot (yesterday).",
          triggers: [
            {
              method: "POST",
              path: "/api/stats/snapshot",
              payload: {},
            },
          ],
        },
        {
          id: "daily-backfill",
          name: "Daily Stats Backfill",
          type: "startup",
          schedule: "on-startup",
          enabled: getSetting("daily-backfill")?.enabled ?? true,
          disabledReason: getSetting("daily-backfill")?.disabledReason ?? null,
          bootstrapBlocked: isBootstrapBlocked,
          description: "Backfills missing daily snapshots on server start.",
          triggers: [
            {
              method: "POST",
              path: "/api/stats/history/backfill",
              payload: { startDate: null, endDate: null },
            },
          ],
        },
      ],
    },
  });
});

schedulerRoutes.post("/historical-backfill/run", async (c) => {
  const bootstrapState = await new BootstrapService(prisma).getState();
  if (!bootstrapState || bootstrapState.state !== "completed") {
    return c.json(
      {
        success: false,
        error: { code: "BOOTSTRAP_INCOMPLETE", message: "Bootstrap must complete first" },
      },
      409,
    );
  }

  const result = await new HistoricalBackfillPlanner(prisma).queueNextYear();
  return c.json({ success: true, data: result }, result.queued ? 202 : 200);
});

schedulerRoutes.patch("/:id", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json().catch(() => ({}));
  const enabled = typeof body.enabled === "boolean" ? body.enabled : null;
  const reason = typeof body.reason === "string" ? body.reason.trim() : null;

  if (enabled === null) {
    return c.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "enabled must be boolean" },
      },
      400,
    );
  }

  const setting = await prisma.schedulerSetting.upsert({
    where: { id },
    update: {
      enabled,
      disabledReason: enabled ? null : reason || null,
    },
    create: {
      id,
      enabled,
      disabledReason: enabled ? null : reason || null,
    },
  });

  await prisma.schedulerSettingEvent.create({
    data: {
      schedulerId: id,
      enabled,
      reason: enabled ? null : reason || null,
      source: "ui",
    },
  });

  return c.json({ success: true, data: setting });
});

schedulerRoutes.get("/:id/events", async (c) => {
  const { id } = c.req.param();
  const limit = Number(c.req.query("limit") ?? 20);

  const events = await prisma.schedulerSettingEvent.findMany({
    where: { schedulerId: id },
    orderBy: { createdAt: "desc" },
    take: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 20,
  });

  return c.json({ success: true, data: { events } });
});

schedulerRoutes.get("/:id/logs", async (c) => {
  const { id } = c.req.param();
  const limit = Number(c.req.query("limit") ?? 20);

  const jobTypeMap: Record<string, string[]> = {
    "full-sync": ["full"],
    "outreach-articles": ["outreach_articles"],
    "daily-stats": ["history_backfill"],
    "daily-backfill": ["history_backfill"],
    "historical-backfill": ["historical_pageviews", "history_backfill"],
  };

  const jobTypes = jobTypeMap[id] ?? [];
  if (jobTypes.length === 0) {
    return c.json({ success: true, data: { logs: [] } });
  }

  const logs = await prisma.syncJob.findMany({
    where: { jobType: { in: jobTypes } },
    orderBy: { createdAt: "desc" },
    take: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 20,
    select: {
      id: true,
      jobType: true,
      status: true,
      createdAt: true,
      startedAt: true,
      completedAt: true,
      error: true,
      metadata: true,
    },
  });

  return c.json({ success: true, data: { logs } });
});
