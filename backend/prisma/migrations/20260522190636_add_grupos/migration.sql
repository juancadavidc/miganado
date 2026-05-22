-- CreateTable
CREATE TABLE "Grupo" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "sexo" "Sexo" NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "potreroId" TEXT,
    "ingresoPotrero" TIMESTAMP(3),
    "loteId" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grupo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Grupo_userId_idx" ON "Grupo"("userId");

-- CreateIndex
CREATE INDEX "Grupo_potreroId_idx" ON "Grupo"("potreroId");

-- CreateIndex
CREATE INDEX "Grupo_loteId_idx" ON "Grupo"("loteId");

-- AddForeignKey
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_potreroId_fkey" FOREIGN KEY ("potreroId") REFERENCES "Potrero"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
