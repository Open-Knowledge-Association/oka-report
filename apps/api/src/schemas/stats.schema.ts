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

export const WikiStatSchema = z.object({
  wiki: z.string(),
  count: z.number().int(),
  pageviews: z.number().int(),
});

export const OutreachArticleStatsResponseSchema = z.object({
  totalArticles: z.number().int(),
  totalPageviews: z.number().int(),
  uniqueWikis: z.number().int(),
  wikiStats: z.array(WikiStatSchema),
});
