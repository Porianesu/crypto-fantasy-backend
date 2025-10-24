-- CreateTable
CREATE TABLE "ClientCard" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientCardSkill" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientCardSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ClientCardToClientCardSkill" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ClientCardToClientCardSkill_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientCard_name_key" ON "ClientCard"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ClientCardSkill_name_key" ON "ClientCardSkill"("name");

-- CreateIndex
CREATE INDEX "_ClientCardToClientCardSkill_B_index" ON "_ClientCardToClientCardSkill"("B");

-- AddForeignKey
ALTER TABLE "_ClientCardToClientCardSkill" ADD CONSTRAINT "_ClientCardToClientCardSkill_A_fkey" FOREIGN KEY ("A") REFERENCES "ClientCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClientCardToClientCardSkill" ADD CONSTRAINT "_ClientCardToClientCardSkill_B_fkey" FOREIGN KEY ("B") REFERENCES "ClientCardSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
