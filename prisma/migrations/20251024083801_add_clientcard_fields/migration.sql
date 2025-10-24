/*
  Warnings:

  - Added the required column `attack_points` to the `ClientCard` table without a default value. This is not possible if the table is not empty.
  - Added the required column `health_points` to the `ClientCard` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ClientCard" ADD COLUMN     "attack_points" INTEGER NOT NULL,
ADD COLUMN     "health_points" INTEGER NOT NULL;
