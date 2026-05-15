-- CreateTable
CREATE TABLE "Anotacion" (
    "id" TEXT NOT NULL,
    "loteId" TEXT,
    "animalId" TEXT,
    "gastoId" TEXT,
    "texto" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Anotacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Anotacion_loteId_idx" ON "Anotacion"("loteId");

-- CreateIndex
CREATE INDEX "Anotacion_animalId_idx" ON "Anotacion"("animalId");

-- CreateIndex
CREATE INDEX "Anotacion_gastoId_idx" ON "Anotacion"("gastoId");

-- AddForeignKey
ALTER TABLE "Anotacion" ADD CONSTRAINT "Anotacion_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anotacion" ADD CONSTRAINT "Anotacion_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anotacion" ADD CONSTRAINT "Anotacion_gastoId_fkey" FOREIGN KEY ("gastoId") REFERENCES "Gasto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
