-- CreateTable
CREATE TABLE "UserSignIn" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "signInDate" TIMESTAMP(3) NOT NULL,
    "rewardIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSignIn_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UserSignIn" ADD CONSTRAINT "UserSignIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
