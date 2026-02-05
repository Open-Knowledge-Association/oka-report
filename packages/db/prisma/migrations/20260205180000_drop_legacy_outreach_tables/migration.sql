-- DropForeignKey (must drop before tables)
ALTER TABLE "outreach_article_pageviews" DROP CONSTRAINT IF EXISTS "outreach_article_pageviews_outreachArticleId_fkey";
ALTER TABLE "outreach_article_editors" DROP CONSTRAINT IF EXISTS "outreach_article_editors_outreachArticleId_fkey";
ALTER TABLE "outreach_article_editors" DROP CONSTRAINT IF EXISTS "outreach_article_editors_editorId_fkey";

-- DropTable
DROP TABLE IF EXISTS "outreach_article_pageviews";
DROP TABLE IF EXISTS "outreach_article_editors";
DROP TABLE IF EXISTS "outreach_articles";
