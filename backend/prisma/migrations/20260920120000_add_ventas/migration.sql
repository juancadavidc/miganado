-- CreateTable
CREATE TABLE "Venta" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "animalId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "pesoTotal" DECIMAL(12,2),
    "valorTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "deduccion" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "valorRecibido" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "comprador" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Venta_loteId_fecha_idx" ON "Venta"("loteId", "fecha");

-- CreateIndex: un animal individual se vende una sola vez
CREATE UNIQUE INDEX "Venta_animalId_key" ON "Venta"("animalId");

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
