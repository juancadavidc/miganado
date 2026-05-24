import { prisma } from './prisma.js';

// Un lote es accesible por su dueño y por su cuidador (ya aceptado: el cuidador
// solo queda en cuidadorId cuando aceptó el traslado). Cualquier otro usuario no
// debe poder verlo ni operarlo.
export type LoteRoles = { duenoId: string; cuidadorId: string | null };

export function esDueno(lote: LoteRoles, userId: string): boolean {
  return lote.duenoId === userId;
}

export function esCuidador(lote: LoteRoles, userId: string): boolean {
  return lote.cuidadorId === userId;
}

export function puedeOperar(lote: LoteRoles, userId: string): boolean {
  return esDueno(lote, userId) || esCuidador(lote, userId);
}

// Devuelve los roles del lote si el usuario puede operarlo (dueño o cuidador),
// o null si el lote no existe o el usuario no tiene acceso.
export async function rolesEnLote(userId: string, loteId: string): Promise<LoteRoles | null> {
  const lote = await prisma.lote.findFirst({
    where: { id: loteId, OR: [{ duenoId: userId }, { cuidadorId: userId }] },
    select: { duenoId: true, cuidadorId: true },
  });
  return lote;
}

// Filtro de Prisma para "lotes que este usuario puede ver" (propios o que cuida).
export function lotesVisiblesWhere(userId: string) {
  return { OR: [{ duenoId: userId }, { cuidadorId: userId }] };
}

// Para incluir dueño/cuidador en las respuestas sin exponer el passwordHash.
export const usuarioPublicSelect = { id: true, nombre: true, documento: true } as const;
