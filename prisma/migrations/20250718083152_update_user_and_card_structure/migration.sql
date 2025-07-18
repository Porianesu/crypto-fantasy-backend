/*
  Warnings:

  - You are about to drop the column `30_win_rate` on the `Card` table. All the data in the column will be lost.
  - You are about to drop the column `avg_duration` on the `Card` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `30_winrate` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `average_duration` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nickname` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `email` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Card" DROP COLUMN "30_win_rate",
DROP COLUMN "avg_duration",
ADD COLUMN     "30_winrate" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "average_duration" INTEGER NOT NULL,
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "nickname" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cardsBag" INTEGER[],
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "expPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "faithAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "hasAlreadyReadGuide" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "meltCurrent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "meltMax" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
