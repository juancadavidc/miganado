-- CreateEnum
CREATE TYPE "PrenezEstado" AS ENUM ('PRENADA', 'PARIO', 'ABORTO');

-- CreateTable
CREATE TABLE "Prenez" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "estado" "PrenezEstado" NOT NULL DEFAULT 'PRENADA',
    "fechaDiagnostico" TIMESTAMP(3) NOT NULL,
    "fechaParto" TIMESTAMP(3),
    "criasMacho" INTEGER NOT NULL DEFAULT 0,
    "criasHembra" INTEGER NOT NULL DEFAULT 0,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prenez_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Prenez_animalId_idx" ON "Prenez"("animalId");

-- AddForeignKey
ALTER TABLE "Prenez" ADD CONSTRAINT "Prenez_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
