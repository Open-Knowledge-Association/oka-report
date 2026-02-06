-- AlterTable
ALTER TABLE "articles" ALTER COLUMN "pageId" DROP NOT NULL;
UPDATE "articles" SET "pageId" = NULL WHERE "pageId" = 0;
