-- CreateTable
CREATE TABLE "TwitterOauthToken" (
    "id" SERIAL NOT NULL,
    "oauthToken" TEXT NOT NULL,
    "oauthTokenSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwitterOauthToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TwitterOauthToken_oauthToken_key" ON "TwitterOauthToken"("oauthToken");
