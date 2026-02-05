import { Hono } from "hono";
import { prisma } from "@repo/db";
import { StatsService } from "../services";
import { PaginationSchema, StatsFilterSchema, TimeSeriesSchema } from "../schemas";

const statsService = new StatsService(prisma);
export const statsRoutes = new Hono();

const parseFilters = (input: Record<string, string | undefined>) => {
  const parsed = StatsFilterSchema.parse(input);
  return {
    startDate: parsed.startDate ? new Date(parsed.startDate) : undefined,
    endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
    wikiProject: parsed.wikiProject,
    editorId: parsed.editorId,
    source: parsed.source,
  };
};

statsRoutes.get("/overall", async (c) => {
  const filters = parseFilters(c.req.query());
  const totals = await statsService.getOverallStats(filters);
  const byWikiProject = await statsService.getStatsByWikiProject(filters);

  return c.json({
    success: true,
    data: {
      totals,
      byWikiProject,
    },
    meta: {
      dateRange: {
        start: filters.startDate?.toISOString(),
        end: filters.endDate?.toISOString(),
      },
      generatedAt: new Date().toISOString(),
    },
  });
});

statsRoutes.get("/editors", async (c) => {
  const filters = parseFilters(c.req.query());
  const pagination = PaginationSchema.parse(c.req.query());
  const stats = await statsService.getStatsByEditor(filters);

  const startIndex = (pagination.page - 1) * pagination.limit;
  const paged = stats.slice(startIndex, startIndex + pagination.limit);

  return c.json({
    success: true,
    data: paged,
    meta: {
      total: stats.length,
      page: pagination.page,
      limit: pagination.limit,
    },
  });
});

statsRoutes.get("/editors/:id", async (c) => {
  const filters = parseFilters({ ...c.req.query(), editorId: c.req.param("id") });
  const stats = await statsService.getStatsByEditor(filters);

  if (stats.length === 0) {
    return c.json(
      { success: false, error: { code: "not_found", message: "Editor not found" } },
      404,
    );
  }

  return c.json({ success: true, data: stats[0] });
});

statsRoutes.get("/timeseries", async (c) => {
  const parsed = TimeSeriesSchema.parse(c.req.query());
  const filters = parseFilters(parsed);
  const granularity = parsed.granularity ?? "daily";
  const series = await statsService.getTimeSeries(filters, granularity);

  return c.json({ success: true, data: { granularity, series } });
});
