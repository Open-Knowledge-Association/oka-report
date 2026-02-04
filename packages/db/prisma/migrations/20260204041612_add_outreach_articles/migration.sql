-- CreateTable
CREATE TABLE "outreach_articles" (
    "id" TEXT NOT NULL,
    "outreachId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "project" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "characterSum" INTEGER NOT NULL DEFAULT 0,
    "referencesCount" INTEGER NOT NULL DEFAULT 0,
    "isNewArticle" BOOLEAN NOT NULL DEFAULT false,
    "rating" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outreach_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_article_pageviews" (
    "id" TEXT NOT NULL,
    "outreachArticleId" TEXT NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "cumulativeViews" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outreach_article_pageviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_article_editors" (
    "id" TEXT NOT NULL,
    "outreachArticleId" TEXT NOT NULL,
    "editorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outreach_article_editors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outreach_articles_outreachId_key" ON "outreach_articles"("outreachId");

-- CreateIndex
CREATE INDEX "outreach_articles_language_project_idx" ON "outreach_articles"("language", "project");

-- CreateIndex
CREATE INDEX "outreach_article_pageviews_snapshotDate_idx" ON "outreach_article_pageviews"("snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "outreach_article_pageviews_outreachArticleId_snapshotDate_key" ON "outreach_article_pageviews"("outreachArticleId", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "outreach_article_editors_outreachArticleId_editorId_key" ON "outreach_article_editors"("outreachArticleId", "editorId");

-- AddForeignKey
ALTER TABLE "outreach_article_pageviews" ADD CONSTRAINT "outreach_article_pageviews_outreachArticleId_fkey" FOREIGN KEY ("outreachArticleId") REFERENCES "outreach_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_article_editors" ADD CONSTRAINT "outreach_article_editors_outreachArticleId_fkey" FOREIGN KEY ("outreachArticleId") REFERENCES "outreach_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_article_editors" ADD CONSTRAINT "outreach_article_editors_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "editors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
