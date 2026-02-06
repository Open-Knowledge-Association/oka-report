-- CreateTable
CREATE TABLE "daily_wiki_source_stats" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "wikiProject" TEXT NOT NULL,
    "source" "ArticleSource" NOT NULL,
    "edits" INTEGER NOT NULL,
    "wordsAdded" INTEGER NOT NULL,
    "pageviews" INTEGER NOT NULL,
    "articlesCreated" INTEGER NOT NULL,
    "articlesEdited" INTEGER NOT NULL,
    "editors" INTEGER NOT NULL,
    "referencesAdded" INTEGER NOT NULL,
    "commonsUploads" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_wiki_source_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_wiki_source_stats_date_idx" ON "daily_wiki_source_stats"("date");

-- CreateIndex
CREATE INDEX "daily_wiki_source_stats_wikiProject_idx" ON "daily_wiki_source_stats"("wikiProject");

-- CreateIndex
CREATE INDEX "daily_wiki_source_stats_source_idx" ON "daily_wiki_source_stats"("source");

-- CreateIndex
CREATE UNIQUE INDEX "daily_wiki_source_stats_date_wikiProject_source_key" ON "daily_wiki_source_stats"("date", "wikiProject", "source");
