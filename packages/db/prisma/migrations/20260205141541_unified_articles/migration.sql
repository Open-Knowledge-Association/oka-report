-- CreateEnum
CREATE TYPE "ArticleSource" AS ENUM ('MEDIAWIKI', 'OUTREACH_DASHBOARD');

-- CreateEnum
CREATE TYPE "PageviewType" AS ENUM ('DAILY', 'CUMULATIVE');

-- AlterTable
ALTER TABLE "articles"
ADD COLUMN "source" "ArticleSource" NOT NULL DEFAULT 'MEDIAWIKI',
ADD COLUMN "outreachId" INTEGER,
ADD COLUMN "url" TEXT,
ADD COLUMN "characterSum" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "referencesCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "isNewArticle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "rating" TEXT;

-- AlterTable
ALTER TABLE "pageviews"
ADD COLUMN "type" "PageviewType" NOT NULL DEFAULT 'DAILY',
ADD COLUMN "cumulativeViews" INTEGER;

-- CreateTable
CREATE TABLE "article_editors" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "editorId" TEXT NOT NULL,
    "isAuthor" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_editors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "articles_outreachId_key" ON "articles"("outreachId");

-- CreateIndex
CREATE UNIQUE INDEX "article_editors_articleId_editorId_key" ON "article_editors"("articleId", "editorId");

-- CreateIndex
CREATE INDEX "article_editors_articleId_idx" ON "article_editors"("articleId");

-- CreateIndex
CREATE INDEX "article_editors_editorId_idx" ON "article_editors"("editorId");

-- AddForeignKey
ALTER TABLE "article_editors" ADD CONSTRAINT "article_editors_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_editors" ADD CONSTRAINT "article_editors_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "editors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
