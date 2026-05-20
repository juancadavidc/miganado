-- CreateTable
CREATE TABLE "Potrero" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ocupado" BOOLEAN NOT NULL DEFAULT false,
    "ocupadoDesde" TIMESTAMP(3),
    "vacioDesde" TIMESTAMP(3),
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Potrero_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Potrero_userId_idx" ON "Potrero"("userId");

-- AddForeignKey
ALTER TABLE "Potrero" ADD CONSTRAINT "Potrero_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
