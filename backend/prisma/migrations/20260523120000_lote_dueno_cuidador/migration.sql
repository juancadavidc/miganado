-- CreateEnum
CREATE TYPE "TrasladoRol" AS ENUM ('DUENO', 'CUIDADOR');

-- CreateEnum
CREATE TYPE "TrasladoEstado" AS ENUM ('PENDIENTE', 'ACEPTADO', 'RECHAZADO', 'CANCELADO');

-- AlterTable: agregar dueño y cuidador (nullable temporal para poder hacer el backfill).
ALTER TABLE "Lote" ADD COLUMN "duenoId" TEXT;
ALTER TABLE "Lote" ADD COLUMN "cuidadorId" TEXT;

-- Backfill: hoy cada lote pertenece a su único usuario (el "tenant" via userId).
-- Ese usuario pasa a ser, a la vez, dueño y cuidador del lote.
UPDATE "Lote" SET "duenoId" = "userId", "cuidadorId" = "userId";

-- Ya con todos los lotes con dueño, forzar NOT NULL en dueño.
ALTER TABLE "Lote" ALTER COLUMN "duenoId" SET NOT NULL;

-- Quitar el userId viejo: queda reemplazado por duenoId.
ALTER TABLE "Lote" DROP CONSTRAINT "Lote_userId_fkey";
DROP INDEX "Lote_userId_fecha_idx";
ALTER TABLE "Lote" DROP COLUMN "userId";

-- Índices y llaves foráneas nuevas.
CREATE INDEX "Lote_duenoId_fecha_idx" ON "Lote"("duenoId", "fecha");
CREATE INDEX "Lote_cuidadorId_idx" ON "Lote"("cuidadorId");

ALTER TABLE "Lote" ADD CONSTRAINT "Lote_duenoId_fkey" FOREIGN KEY ("duenoId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_cuidadorId_fkey" FOREIGN KEY ("cuidadorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Traslado" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "rol" "TrasladoRol" NOT NULL,
    "paraUserId" TEXT NOT NULL,
    "creadoPorId" TEXT NOT NULL,
    "estado" "TrasladoEstado" NOT NULL DEFAULT 'PENDIENTE',
    "mensaje" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondidoAt" TIMESTAMP(3),

    CONSTRAINT "Traslado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Traslado_loteId_idx" ON "Traslado"("loteId");

-- CreateIndex
CREATE INDEX "Traslado_paraUserId_idx" ON "Traslado"("paraUserId");

-- CreateIndex
CREATE INDEX "Traslado_creadoPorId_idx" ON "Traslado"("creadoPorId");

-- AddForeignKey
ALTER TABLE "Traslado" ADD CONSTRAINT "Traslado_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Traslado" ADD CONSTRAINT "Traslado_paraUserId_fkey" FOREIGN KEY ("paraUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Traslado" ADD CONSTRAINT "Traslado_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
