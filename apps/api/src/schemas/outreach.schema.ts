import { z } from "zod";

export const OutreachArticlesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  search: z.string().min(1).optional(),
  wiki: z.string().min(1).optional(), // Format: "en.wikipedia"
});

export type OutreachArticlesQuery = z.infer<typeof OutreachArticlesQuerySchema>;
