-- AlterTable
ALTER TABLE "User" ADD COLUMN     "craftCountSinceLastEpic" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "craftCountSinceLastLegendary" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "craftCountSinceLastRare" INTEGER NOT NULL DEFAULT 0;
