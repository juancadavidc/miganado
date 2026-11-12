-- DropIndex
DROP INDEX "User_telegramChatId_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "telegramBotId" TEXT,
ADD COLUMN     "telegramBotToken" TEXT,
ADD COLUMN     "telegramBotUsername" TEXT,
ADD COLUMN     "telegramCodigo" TEXT,
ADD COLUMN     "telegramCodigoExpira" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramBotId_key" ON "User"("telegramBotId");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramCodigo_key" ON "User"("telegramCodigo");

