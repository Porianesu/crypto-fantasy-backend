-- CreateTable
CREATE TABLE "Skill" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "baseRaceId" INTEGER NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_baseRaceId_fkey" FOREIGN KEY ("baseRaceId") REFERENCES "BaseRace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
