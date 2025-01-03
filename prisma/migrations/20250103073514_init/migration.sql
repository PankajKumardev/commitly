/*
  Warnings:

  - You are about to drop the column `githubId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `User` table. All the data in the column will be lost.
  - Added the required column `auth_type` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "User_githubId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "githubId",
DROP COLUMN "image",
ADD COLUMN     "auth_type" BOOLEAN NOT NULL;
