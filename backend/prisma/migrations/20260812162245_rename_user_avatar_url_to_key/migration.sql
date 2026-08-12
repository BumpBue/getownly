/*
  Warnings:

  - You are about to drop the column `avatarUrl` on the `User` table. All the data in the column will be lost.

*/

-- No PATCH /users/me/avatar has ever existed, so this column has been NULL
-- for every user in every environment - drop-and-add loses nothing here,
-- unlike the Course.coverKey rename (20260811163000) which used RENAME
-- COLUMN specifically because that column already held real data.
-- AlterTable
ALTER TABLE "User" DROP COLUMN "avatarUrl",
ADD COLUMN     "avatarKey" TEXT;
