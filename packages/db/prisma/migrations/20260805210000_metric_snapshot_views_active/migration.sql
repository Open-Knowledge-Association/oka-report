-- Rename viewsUser -> viewsActive (semantics: pageviews of articles created/edited
-- in the period, not human-only views).
ALTER TABLE "metric_snapshots" RENAME COLUMN "viewsUser" TO "viewsActive";
ALTER TABLE "period_article_activity" RENAME COLUMN "viewsUser" TO "viewsActive";
