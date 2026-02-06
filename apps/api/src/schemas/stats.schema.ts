import { z } from "zod";

export const StatsFilterSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  wikiProject: z.string().min(1).optional(),
  editorId: z.string().min(1).optional(),
  source: z.enum(["MEDIAWIKI", "OUTREACH_DASHBOARD"]).optional(),
});

export const TimeSeriesSchema = StatsFilterSchema.extend({
  granularity: z.enum(["daily", "weekly", "monthly"]).optional(),
});

export const HistoryRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  withDelta: z.coerce.boolean().optional(),
  wikiProject: z.string().min(1).optional(),
  source: z.enum(["MEDIAWIKI", "OUTREACH_DASHBOARD"]).optional(),
});

export const HistoryBackfillSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export const EditorHistoryQuerySchema = HistoryRangeSchema.extend({
  editorId: z.string().min(1),
});

export const ArticleHistoryQuerySchema = HistoryRangeSchema.extend({
  articleId: z.string().min(1),
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

export const AnnualStatsQuerySchema = z.object({
  year: z.coerce
    .number()
    .int()
    .min(2000)
    .max(new Date().getFullYear() + 1),
  wikiProject: z.string().min(1).optional(),
  source: z.enum(["MEDIAWIKI", "OUTREACH_DASHBOARD"]).optional(),
  includeYoY: z.coerce.boolean().optional(),
});

export const TopArticlesQuerySchema = z.object({
  year: z.coerce
    .number()
    .int()
    .min(2000)
    .max(new Date().getFullYear() + 1),
  wikiProject: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const ReportExportQuerySchema = z.object({
  year: z.coerce
    .number()
    .int()
    .min(2000)
    .max(new Date().getFullYear() + 1),
  format: z.enum(["pdf", "csv", "json"]),
  wikiProject: z.string().min(1).optional(),
});

export const AnnualStatsResponseSchema = z.object({
  year: z.number().int(),
  totalEditors: z.number().int(),
  totalEdits: z.number().int(),
  totalWordsAdded: z.number().int(),
  totalPageviews: z.number().int(),
  totalArticlesCreated: z.number().int(),
  totalArticlesModified: z.number().int(),
  wikiProject: z.string(),
  source: z.enum(["MEDIAWIKI", "OUTREACH_DASHBOARD"]),
  yearOverYearGrowth: z
    .object({
      editsGrowth: z.number(),
      wordsAddedGrowth: z.number(),
      pageviewsGrowth: z.number(),
    })
    .optional(),
});

export const TopArticle = z.object({
  articleTitle: z.string(),
  wordCount: z.number().int(),
  edits: z.number().int(),
  pageviews: z.number().int(),
  createdBy: z.string(),
});

export const TopArticlesResponseSchema = z.object({
  year: z.number().int(),
  wikiProject: z.string(),
  articles: z.array(TopArticle),
  totalCount: z.number().int(),
});
