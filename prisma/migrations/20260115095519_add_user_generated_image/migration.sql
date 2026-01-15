-- CreateTable
CREATE TABLE "UserGeneratedImage" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "imageBytes" BYTEA NOT NULL,
    "cardName" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "cardEffect" TEXT NOT NULL,
    "cardDescription" TEXT,
    "artStyle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserGeneratedImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserGeneratedImage_userId_idx" ON "UserGeneratedImage"("userId");

-- AddForeignKey
ALTER TABLE "UserGeneratedImage" ADD CONSTRAINT "UserGeneratedImage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
