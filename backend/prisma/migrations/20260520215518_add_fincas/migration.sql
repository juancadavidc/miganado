-- CreateTable
CREATE TABLE "Finca" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "capacidad" INTEGER NOT NULL DEFAULT 16,
    "propiedades" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Finca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Finca_userId_idx" ON "Finca"("userId");

-- AddForeignKey
ALTER TABLE "Finca" ADD CONSTRAINT "Finca_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: agregar fincaId nullable de forma temporal para poder hacer el backfill.
ALTER TABLE "Potrero" ADD COLUMN "fincaId" TEXT;

-- Backfill: una finca por defecto ("Mi finca") por cada usuario que ya tenga potreros.
-- capacidad = 16 porque el mapa actual era de 16 columnas de ancho.
INSERT INTO "Finca" ("id", "userId", "nombre", "capacidad", "updatedAt")
SELECT gen_random_uuid()::text, u."id", 'Mi finca', 16, CURRENT_TIMESTAMP
FROM "User" u
WHERE EXISTS (SELECT 1 FROM "Potrero" p WHERE p."userId" = u."id");

-- Asignar cada potrero existente a la finca por defecto de su dueño.
UPDATE "Potrero" p
SET "fincaId" = f."id"
FROM "Finca" f
WHERE f."userId" = p."userId";

-- Ya con todos los potreros asignados, forzar NOT NULL + FK + índice.
ALTER TABLE "Potrero" ALTER COLUMN "fincaId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Potrero_fincaId_idx" ON "Potrero"("fincaId");

-- AddForeignKey
ALTER TABLE "Potrero" ADD CONSTRAINT "Potrero_fincaId_fkey" FOREIGN KEY ("fincaId") REFERENCES "Finca"("id") ON DELETE CASCADE ON UPDATE CASCADE;
