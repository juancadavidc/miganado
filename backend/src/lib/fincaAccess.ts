import { prisma } from './prisma.js';

// La finca es la unidad de propiedad: la posee un dueño y la cuida un cuidador
// (ya aceptado; el cuidador solo queda en cuidadorId cuando aceptó el traslado).
// Potreros y lotes heredan el acceso de su finca: ambos roles pueden operarlos.
export type FincaRoles = { duenoId: string; cuidadorId: string | null };

export const usuarioPublicSelect = { id: true, nombre: true, documento: true } as const;

export function esDueno(finca: FincaRoles, userId: string): boolean {
  return finca.duenoId === userId;
}

export function esCuidador(finca: FincaRoles, userId: string): boolean {
  return finca.cuidadorId === userId;
}

export function puedeOperar(finca: FincaRoles, userId: string): boolean {
  return esDueno(finca, userId) || esCuidador(finca, userId);
}

// Filtro Prisma: fincas que el usuario puede ver (propias o que cuida).
export function fincasVisiblesWhere(userId: string) {
  return { OR: [{ duenoId: userId }, { cuidadorId: userId }] };
}

// Filtro Prisma: lotes cuya finca el usuario puede operar.
export function lotesVisiblesWhere(userId: string) {
  return { finca: fincasVisiblesWhere(userId) };
}

// Filtro Prisma: fincas que el usuario puede LEER: las que opera más las que le
// compartieron en solo lectura. Úsalo solo en rutas GET.
export function fincasLegiblesWhere(userId: string) {
  return { OR: [{ duenoId: userId }, { cuidadorId: userId }, { lectores: { some: { userId } } }] };
}

// Filtro Prisma: lotes cuya finca el usuario puede leer. Solo para rutas GET.
export function lotesLegiblesWhere(userId: string) {
  return { finca: fincasLegiblesWhere(userId) };
}

export type MiRol = 'DUENO' | 'CUIDADOR' | 'LECTOR';

// Rol del usuario en una finca que ya sabemos legible. El frontend lo usa para
// esconder los controles de edición cuando es LECTOR.
export function miRol(finca: FincaRoles, userId: string): MiRol {
  if (esDueno(finca, userId)) return 'DUENO';
  if (esCuidador(finca, userId)) return 'CUIDADOR';
  return 'LECTOR';
}

// Roles del usuario en una finca, o null si no tiene acceso.
export async function rolesEnFinca(userId: string, fincaId: string): Promise<FincaRoles | null> {
  return prisma.finca.findFirst({
    where: { id: fincaId, ...fincasVisiblesWhere(userId) },
    select: { duenoId: true, cuidadorId: true },
  });
}

// Roles del usuario en la finca de un lote, o null si no puede acceder al lote.
export async function rolesEnFincaDeLote(userId: string, loteId: string): Promise<FincaRoles | null> {
  const lote = await prisma.lote.findFirst({
    where: { id: loteId, ...lotesVisiblesWhere(userId) },
    select: { finca: { select: { duenoId: true, cuidadorId: true } } },
  });
  return lote?.finca ?? null;
}
