-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "avatar" TEXT,
    "solAsset" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "faction" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "rarity" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "30_pnl" DOUBLE PRECISION NOT NULL,
    "30_win_rate" DOUBLE PRECISION NOT NULL,
    "avg_duration" INTEGER NOT NULL,
    "backstory" TEXT NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
