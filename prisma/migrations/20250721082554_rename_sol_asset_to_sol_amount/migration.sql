/*
  Warnings:

  - You are about to drop the column `solAsset` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "solAsset",
ADD COLUMN     "solAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
