/*
  Warnings:

  - You are about to drop the column `displayName` on the `editors` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "editors" DROP COLUMN "displayName",
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';
