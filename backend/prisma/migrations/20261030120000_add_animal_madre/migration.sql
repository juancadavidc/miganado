-- Cría separada de su madre (VP): enlace a la madre para trazabilidad.
ALTER TABLE "Animal" ADD COLUMN "madreId" TEXT;

-- CreateIndex
CREATE INDEX "Animal_madreId_idx" ON "Animal"("madreId");

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_madreId_fkey" FOREIGN KEY ("madreId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
