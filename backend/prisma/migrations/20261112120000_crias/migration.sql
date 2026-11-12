-- AlterTable
ALTER TABLE "Animal" ADD COLUMN     "destetadoAt" TIMESTAMP(3),
ADD COLUMN     "esCria" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "muerteFecha" TIMESTAMP(3),
ADD COLUMN     "nacimiento" TIMESTAMP(3),
ADD COLUMN     "vinoConMadre" BOOLEAN NOT NULL DEFAULT false;


-- Las crías que ya existían (separadas de una VP) quedan marcadas como crías.
UPDATE "Animal" SET "esCria" = true WHERE "madreId" IS NOT NULL;
