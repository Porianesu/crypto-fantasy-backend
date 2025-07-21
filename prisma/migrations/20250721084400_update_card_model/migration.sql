/*
  Warnings:

  - You are about to drop the column `30_pnl` on the `Card` table. All the data in the column will be lost.
  - You are about to drop the column `30_winrate` on the `Card` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Card` table. All the data in the column will be lost.
  - Added the required column `pnl_30` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `score_rank` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `winrate_30` to the `Card` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Card" DROP COLUMN "30_pnl",
DROP COLUMN "30_winrate",
DROP COLUMN "description",
ADD COLUMN     "pnl_30" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "score_rank" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "winrate_30" DOUBLE PRECISION NOT NULL;
