import { z } from "zod";

export const TriggerSyncSchema = z.object({
  jobType: z
    .enum(["full", "program_sync", "snapshot_build", "contributions", "pageviews", "commons"])
    .optional(),
  syncMode: z
    .enum(["bootstrap_full", "scheduled_incremental", "manual_full", "manual_backfill"])
    .optional(),
});

export const OutreachSyncSchema = z.object({
  school: z.string().min(1, "school is required"),
  slug: z.string().min(1, "slug is required"),
});
