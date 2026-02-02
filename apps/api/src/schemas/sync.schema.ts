import { z } from "zod";

export const TriggerSyncSchema = z.object({
  jobType: z
    .enum(["full", "contributions", "pageviews", "commons"])
    .optional(),
});
