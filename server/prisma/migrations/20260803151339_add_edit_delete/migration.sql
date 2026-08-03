-- AlterTable
ALTER TABLE "DirectMessage" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "DirectMessage" ADD COLUMN "editedAt" DATETIME;

-- AlterTable
ALTER TABLE "GroupMessage" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "GroupMessage" ADD COLUMN "editedAt" DATETIME;
