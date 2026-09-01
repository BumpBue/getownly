-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "storageUsedBytes" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "videoSize" INTEGER;
