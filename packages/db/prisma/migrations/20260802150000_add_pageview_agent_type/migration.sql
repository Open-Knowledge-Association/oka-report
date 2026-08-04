-- Add agent dimension required by the current Pageview model.
DO $$ BEGIN
    CREATE TYPE "PageviewAgentType" AS ENUM ('USER', 'ALL_AGENTS');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "pageviews"
  ADD COLUMN IF NOT EXISTS "agentType" "PageviewAgentType" NOT NULL DEFAULT 'ALL_AGENTS';

DROP INDEX IF EXISTS "pageviews_articleId_date_key";
CREATE UNIQUE INDEX IF NOT EXISTS "pageviews_articleId_date_type_agentType_key"
  ON "pageviews"("articleId", "date", "type", "agentType");
CREATE INDEX IF NOT EXISTS "pageviews_agentType_idx" ON "pageviews"("agentType");
