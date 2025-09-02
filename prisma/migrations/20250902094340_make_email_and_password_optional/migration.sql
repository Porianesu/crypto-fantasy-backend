/*
  Warnings:

  - A unique constraint covering the columns `[address]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "address" TEXT,
ADD COLUMN     "nonce" TEXT,
ALTER COLUMN "password" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_address_key" ON "User"("address");
