DO $$ BEGIN
    CREATE TYPE "ArticleSource" AS ENUM ('MEDIAWIKI', 'OUTREACH_DASHBOARD');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE "daily_source_stats" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
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

    CONSTRAINT "daily_source_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_source_stats_date_idx" ON "daily_source_stats"("date");

-- CreateIndex
CREATE INDEX "daily_source_stats_source_idx" ON "daily_source_stats"("source");

-- CreateIndex
CREATE UNIQUE INDEX "daily_source_stats_date_source_key" ON "daily_source_stats"("date", "source");
