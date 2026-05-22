import type { Sexo } from '@prisma/client';

// Nombre por defecto del grupo de ganado que se crea junto con un lote. Usa el
// número de lote de la feria si existe; si no, cae al sexo. El ganadero lo puede
// renombrar después.
export function nombreGrupoDeLote(lote: { loteNumero: string | null; sexo: Sexo }): string {
  return lote.loteNumero ? `Lote ${lote.loteNumero}` : `Grupo ${lote.sexo}`;
}
