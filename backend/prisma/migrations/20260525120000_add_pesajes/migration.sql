-- CreateTable
CREATE TABLE "Pesaje" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "pesoTotal" DECIMAL(12,2) NOT NULL,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pesaje_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pesaje_loteId_fecha_idx" ON "Pesaje"("loteId", "fecha");

-- AddForeignKey
ALTER TABLE "Pesaje" ADD CONSTRAINT "Pesaje_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
