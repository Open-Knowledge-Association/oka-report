import { z } from "zod";

export const StatsFilterSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  wikiProject: z.string().min(1).optional(),
  editorId: z.string().min(1).optional(),
});

export const TimeSeriesSchema = StatsFilterSchema.extend({
  granularity: z.enum(["daily", "weekly", "monthly"]).optional(),
});
