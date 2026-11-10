-- AlterTable
ALTER TABLE "Lote" ADD COLUMN     "potreroDesde" TIMESTAMP(3),
ADD COLUMN     "potreroId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "telegramChatId" TEXT;

-- CreateIndex
CREATE INDEX "Lote_potreroId_idx" ON "Lote"("potreroId");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramChatId_key" ON "User"("telegramChatId");

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_potreroId_fkey" FOREIGN KEY ("potreroId") REFERENCES "Potrero"("id") ON DELETE SET NULL ON UPDATE CASCADE;

