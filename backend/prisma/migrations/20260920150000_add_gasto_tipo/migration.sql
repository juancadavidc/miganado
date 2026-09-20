-- CreateEnum
CREATE TYPE "TipoGasto" AS ENUM ('TRANSPORTE', 'COMISION_CUIDADOR', 'VACUNAS', 'DESPARASITANTE', 'MEDICAMENTOS', 'ALIMENTACION', 'ARRIENDO_PASTO', 'JORNALES', 'DOCUMENTOS', 'OTRO');

-- AlterTable: los gastos existentes ya se pagaron (pagado = true) y arrancan como OTRO
ALTER TABLE "Gasto" ADD COLUMN "tipo" "TipoGasto" NOT NULL DEFAULT 'OTRO',
ADD COLUMN "pagado" BOOLEAN NOT NULL DEFAULT true;

-- Backfill: clasifica los gastos viejos por lo que decía la descripción libre
UPDATE "Gasto" SET "tipo" = CASE
  WHEN "descripcion" ~* 'comisi.n.*cuidador|cuidador.*comisi.n' THEN 'COMISION_CUIDADOR'::"TipoGasto"
  WHEN "descripcion" ~* 'transporte|flete' THEN 'TRANSPORTE'::"TipoGasto"
  WHEN "descripcion" ~* 'vacuna|aftosa|brucelosis' THEN 'VACUNAS'::"TipoGasto"
  WHEN "descripcion" ~* 'desparasit' THEN 'DESPARASITANTE'::"TipoGasto"
  ELSE 'OTRO'::"TipoGasto"
END;

-- CreateIndex
CREATE INDEX "Gasto_tipo_idx" ON "Gasto"("tipo");
