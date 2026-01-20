/*
  Warnings:

  - You are about to drop the column `artStyle` on the `UserGeneratedImage` table. All the data in the column will be lost.
  - You are about to drop the column `cardDescription` on the `UserGeneratedImage` table. All the data in the column will be lost.
  - You are about to drop the column `cardEffect` on the `UserGeneratedImage` table. All the data in the column will be lost.
  - You are about to drop the column `cardName` on the `UserGeneratedImage` table. All the data in the column will be lost.
  - You are about to drop the column `cardType` on the `UserGeneratedImage` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UserGeneratedImage" DROP COLUMN "artStyle",
DROP COLUMN "cardDescription",
DROP COLUMN "cardEffect",
DROP COLUMN "cardName",
DROP COLUMN "cardType";
