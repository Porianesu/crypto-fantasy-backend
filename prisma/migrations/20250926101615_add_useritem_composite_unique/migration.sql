/*
  Warnings:

  - A unique constraint covering the columns `[userId,itemId]` on the table `UserItem` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "UserItem_userId_itemId_key" ON "UserItem"("userId", "itemId");
