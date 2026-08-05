-- Make wikiProject non-nullable with empty-string sentinel for global rows.
ALTER TABLE "metric_snapshots" ALTER COLUMN "wikiProject" SET DEFAULT '';
UPDATE "metric_snapshots" SET "wikiProject" = '' WHERE "wikiProject" IS NULL;
ALTER TABLE "metric_snapshots" ALTER COLUMN "wikiProject" SET NOT NULL;
