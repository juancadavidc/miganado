-- CreateTable
CREATE TABLE "FincaLector" (
    "fincaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FincaLector_pkey" PRIMARY KEY ("fincaId","userId")
);

-- CreateIndex
CREATE INDEX "FincaLector_userId_idx" ON "FincaLector"("userId");

-- AddForeignKey
ALTER TABLE "FincaLector" ADD CONSTRAINT "FincaLector_fincaId_fkey" FOREIGN KEY ("fincaId") REFERENCES "Finca"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FincaLector" ADD CONSTRAINT "FincaLector_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
