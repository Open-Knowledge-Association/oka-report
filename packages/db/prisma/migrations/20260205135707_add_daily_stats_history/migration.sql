-- CreateTable
CREATE TABLE "daily_stats" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "edits" INTEGER NOT NULL,
    "wordsAdded" INTEGER NOT NULL,
    "pageviews" INTEGER NOT NULL,
    "articlesCreated" INTEGER NOT NULL,
    "articlesEdited" INTEGER NOT NULL,
    "editors" INTEGER NOT NULL,
    "referencesAdded" INTEGER NOT NULL,
    "commonsUploads" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editor_daily_stats" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "editorId" TEXT NOT NULL,
    "edits" INTEGER NOT NULL,
    "wordsAdded" INTEGER NOT NULL,
    "articlesCreated" INTEGER NOT NULL,
    "articlesEdited" INTEGER NOT NULL,
    "referencesAdded" INTEGER NOT NULL,
    "commonsUploads" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "editor_daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_daily_stats" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "articleId" TEXT NOT NULL,
    "pageviews" INTEGER NOT NULL,
    "characterSum" INTEGER NOT NULL,
    "referencesCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_stats_date_idx" ON "daily_stats"("date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_stats_date_key" ON "daily_stats"("date");

-- CreateIndex
CREATE INDEX "editor_daily_stats_date_idx" ON "editor_daily_stats"("date");

-- CreateIndex
CREATE INDEX "editor_daily_stats_editorId_idx" ON "editor_daily_stats"("editorId");

-- CreateIndex
CREATE UNIQUE INDEX "editor_daily_stats_date_editorId_key" ON "editor_daily_stats"("date", "editorId");

-- CreateIndex
CREATE INDEX "article_daily_stats_date_idx" ON "article_daily_stats"("date");

-- CreateIndex
CREATE INDEX "article_daily_stats_articleId_idx" ON "article_daily_stats"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "article_daily_stats_date_articleId_key" ON "article_daily_stats"("date", "articleId");

-- AddForeignKey
ALTER TABLE "editor_daily_stats" ADD CONSTRAINT "editor_daily_stats_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "editors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_daily_stats" ADD CONSTRAINT "article_daily_stats_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
