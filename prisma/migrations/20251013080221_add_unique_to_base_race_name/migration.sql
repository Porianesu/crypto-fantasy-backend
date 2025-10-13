/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `BaseRace` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `HybridRace` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "BaseRace_name_key" ON "BaseRace"("name");

-- CreateIndex
CREATE UNIQUE INDEX "HybridRace_name_key" ON "HybridRace"("name");
