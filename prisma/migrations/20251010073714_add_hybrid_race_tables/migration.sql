-- CreateTable
CREATE TABLE "BaseRace" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "englishName" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "BaseRace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HybridRace" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "englishName" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "HybridRace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RaceBaseHybrid" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_RaceBaseHybrid_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "BaseRace_englishName_key" ON "BaseRace"("englishName");

-- CreateIndex
CREATE UNIQUE INDEX "HybridRace_englishName_key" ON "HybridRace"("englishName");

-- CreateIndex
CREATE INDEX "_RaceBaseHybrid_B_index" ON "_RaceBaseHybrid"("B");

-- AddForeignKey
ALTER TABLE "_RaceBaseHybrid" ADD CONSTRAINT "_RaceBaseHybrid_A_fkey" FOREIGN KEY ("A") REFERENCES "BaseRace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RaceBaseHybrid" ADD CONSTRAINT "_RaceBaseHybrid_B_fkey" FOREIGN KEY ("B") REFERENCES "HybridRace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
