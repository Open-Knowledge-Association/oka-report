ALTER TABLE "articles" ADD COLUMN "authorStatus" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "articles" ADD COLUMN "authorUsername" TEXT;
ALTER TABLE "articles" ADD COLUMN "authorVerifiedAt" TIMESTAMP(3);
