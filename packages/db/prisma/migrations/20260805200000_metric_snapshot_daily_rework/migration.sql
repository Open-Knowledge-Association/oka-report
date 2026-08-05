-- Rework metric_snapshots for daily-first layered rollups:
-- - add DAY to granularity enum
-- - replace pageviews with viewsTotal/viewsUser/refsAdded
-- - add agentType column
-- - new unique key includes agentType
-- - new detail tables: period_article_activity, period_editor_activity

-- 1. Extend enum
ALTER TYPE "Granularity" ADD VALUE IF NOT EXISTS 'DAY' AFTER 'YEAR';

-- 2. Rework metric_snapshots
ALTER TABLE "metric_snapshots" RENAME COLUMN "pageviews" TO "viewsTotal";
ALTER TABLE "metric_snapshots" ADD COLUMN "viewsUser" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "metric_snapshots" ADD COLUMN "refsAdded" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "metric_snapshots" ADD COLUMN "agentType" TEXT NOT NULL DEFAULT 'ALL_AGENTS';

-- Drop old unique key, create new one with agentType
DROP INDEX IF EXISTS "metric_snapshots_granularity_periodStart_programId_wikiPr_key";
CREATE UNIQUE INDEX "metric_snapshots_granularity_periodStart_programId_wikiPr_key"
  ON "metric_snapshots"("granularity", "periodStart", "programId", "wikiProject", "agentType");

-- Backfill agentType split for existing rows: keep ALL_AGENTS rows; viewsUser
-- copies viewsTotal (USER data not yet collected for old rows).
UPDATE "metric_snapshots" SET "viewsUser" = "viewsTotal" WHERE "agentType" = 'ALL_AGENTS';

-- 3. PeriodArticleActivity
CREATE TABLE "period_article_activity" (
    "id" TEXT NOT NULL,
    "granularity" "Granularity" NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "articleId" TEXT NOT NULL,
    "programId" TEXT,
    "wikiProject" TEXT NOT NULL DEFAULT '',
    "edits" INTEGER NOT NULL,
    "wordsAdded" INTEGER NOT NULL,
    "isCreated" BOOLEAN NOT NULL DEFAULT false,
    "viewsTotal" INTEGER NOT NULL DEFAULT 0,
    "viewsUser" INTEGER NOT NULL DEFAULT 0,
    "refsAdded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "period_article_activity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "period_article_activity_granularity_periodStart_article_key"
  ON "period_article_activity"("granularity", "periodStart", "articleId");
CREATE INDEX "period_article_activity_granularity_periodStart_idx" ON "period_article_activity"("granularity", "periodStart");
CREATE INDEX "period_article_activity_articleId_idx" ON "period_article_activity"("articleId");
CREATE INDEX "period_article_activity_programId_granularity_periodStart_idx" ON "period_article_activity"("programId", "granularity", "periodStart");
ALTER TABLE "period_article_activity" ADD CONSTRAINT "period_article_activity_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. PeriodEditorActivity
CREATE TABLE "period_editor_activity" (
    "id" TEXT NOT NULL,
    "granularity" "Granularity" NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "editorId" TEXT NOT NULL,
    "programId" TEXT,
    "edits" INTEGER NOT NULL,
    "wordsAdded" INTEGER NOT NULL,
    "articlesCreated" INTEGER NOT NULL,
    "articlesEdited" INTEGER NOT NULL,
    "commonsUploads" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "period_editor_activity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "period_editor_activity_granularity_periodStart_editor_key"
  ON "period_editor_activity"("granularity", "periodStart", "editorId");
CREATE INDEX "period_editor_activity_granularity_periodStart_idx" ON "period_editor_activity"("granularity", "periodStart");
CREATE INDEX "period_editor_activity_editorId_idx" ON "period_editor_activity"("editorId");
CREATE INDEX "period_editor_activity_programId_granularity_periodStart_idx" ON "period_editor_activity"("programId", "granularity", "periodStart");
ALTER TABLE "period_editor_activity" ADD CONSTRAINT "period_editor_activity_editorId_fkey"
  FOREIGN KEY ("editorId") REFERENCES "editors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
