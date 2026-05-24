-- CreateEnum
CREATE TYPE "TrasladoRol" AS ENUM ('DUENO', 'CUIDADOR');

-- CreateEnum
CREATE TYPE "TrasladoEstado" AS ENUM ('PENDIENTE', 'ACEPTADO', 'RECHAZADO', 'CANCELADO');

-- === Finca: el dueño y el cuidador pasan a vivir en la finca ===
-- Backfill: hoy cada finca pertenece a su único usuario (userId). Ese usuario
-- queda, a la vez, como dueño y cuidador de la finca.
ALTER TABLE "Finca" ADD COLUMN "duenoId" TEXT;
ALTER TABLE "Finca" ADD COLUMN "cuidadorId" TEXT;
UPDATE "Finca" SET "duenoId" = "userId", "cuidadorId" = "userId";
ALTER TABLE "Finca" ALTER COLUMN "duenoId" SET NOT NULL;

ALTER TABLE "Finca" DROP CONSTRAINT "Finca_userId_fkey";
DROP INDEX "Finca_userId_idx";
ALTER TABLE "Finca" DROP COLUMN "userId";

CREATE INDEX "Finca_duenoId_idx" ON "Finca"("duenoId");
CREATE INDEX "Finca_cuidadorId_idx" ON "Finca"("cuidadorId");
ALTER TABLE "Finca" ADD CONSTRAINT "Finca_duenoId_fkey" FOREIGN KEY ("duenoId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Finca" ADD CONSTRAINT "Finca_cuidadorId_fkey" FOREIGN KEY ("cuidadorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- === Lote: ahora pertenece a una finca y hereda su dueño/cuidador ===
ALTER TABLE "Lote" ADD COLUMN "fincaId" TEXT;

-- Para usuarios con lotes pero sin ninguna finca, crear una finca por defecto.
INSERT INTO "Finca" ("id", "duenoId", "cuidadorId", "nombre", "capacidad", "updatedAt")
SELECT gen_random_uuid()::text, u."id", u."id", 'Mi finca', 16, CURRENT_TIMESTAMP
FROM "User" u
WHERE EXISTS (SELECT 1 FROM "Lote" l WHERE l."userId" = u."id")
  AND NOT EXISTS (SELECT 1 FROM "Finca" f WHERE f."duenoId" = u."id");

-- Asignar cada lote existente a la finca más antigua de su dueño actual.
UPDATE "Lote" l
SET "fincaId" = (
  SELECT f."id" FROM "Finca" f
  WHERE f."duenoId" = l."userId"
  ORDER BY f."createdAt" ASC, f."id" ASC
  LIMIT 1
);

ALTER TABLE "Lote" ALTER COLUMN "fincaId" SET NOT NULL;

ALTER TABLE "Lote" DROP CONSTRAINT "Lote_userId_fkey";
DROP INDEX "Lote_userId_fecha_idx";
ALTER TABLE "Lote" DROP COLUMN "userId";

CREATE INDEX "Lote_fincaId_fecha_idx" ON "Lote"("fincaId", "fecha");
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_fincaId_fkey" FOREIGN KEY ("fincaId") REFERENCES "Finca"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- === Potrero: el acceso se hereda de la finca; se quita el userId redundante ===
ALTER TABLE "Potrero" DROP CONSTRAINT "Potrero_userId_fkey";
DROP INDEX "Potrero_userId_idx";
ALTER TABLE "Potrero" DROP COLUMN "userId";

-- === Traslado: traspaso de dueño/cuidador a nivel de finca ===
CREATE TABLE "Traslado" (
    "id" TEXT NOT NULL,
    "fincaId" TEXT NOT NULL,
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
CREATE INDEX "Traslado_fincaId_idx" ON "Traslado"("fincaId");

-- CreateIndex
CREATE INDEX "Traslado_paraUserId_idx" ON "Traslado"("paraUserId");

-- CreateIndex
CREATE INDEX "Traslado_creadoPorId_idx" ON "Traslado"("creadoPorId");

-- AddForeignKey
ALTER TABLE "Traslado" ADD CONSTRAINT "Traslado_fincaId_fkey" FOREIGN KEY ("fincaId") REFERENCES "Finca"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Traslado" ADD CONSTRAINT "Traslado_paraUserId_fkey" FOREIGN KEY ("paraUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Traslado" ADD CONSTRAINT "Traslado_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
