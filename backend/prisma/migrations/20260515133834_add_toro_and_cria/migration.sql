-- CreateEnum
CREATE TYPE "CriaSexo" AS ENUM ('M', 'H');

-- AlterEnum
ALTER TYPE "Sexo" ADD VALUE 'TO';

-- AlterTable
ALTER TABLE "Animal" ADD COLUMN     "criaSexo" "CriaSexo";

-- AlterTable
ALTER TABLE "Lote" ADD COLUMN     "criasHembra" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "criasMacho" INTEGER NOT NULL DEFAULT 0;
