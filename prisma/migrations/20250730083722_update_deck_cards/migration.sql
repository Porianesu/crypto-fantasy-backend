-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deckCards" JSONB NOT NULL DEFAULT '[]';
