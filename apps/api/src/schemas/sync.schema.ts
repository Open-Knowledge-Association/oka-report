import { z } from "zod";

export const TriggerSyncSchema = z.object({
  jobType: z.enum(["full", "contributions", "pageviews", "commons"]).optional(),
});

export const OutreachSyncSchema = z.object({
  school: z.string().min(1, "school is required"),
  slug: z.string().min(1, "slug is required"),
});
