-- CreateTable
CREATE TABLE "TwitterAccount" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "twitterUserId" TEXT NOT NULL,
    "screenName" TEXT NOT NULL,
    "oauthToken" TEXT NOT NULL,
    "oauthTokenSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwitterAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TwitterAccount_userId_key" ON "TwitterAccount"("userId");

-- AddForeignKey
ALTER TABLE "TwitterAccount" ADD CONSTRAINT "TwitterAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
