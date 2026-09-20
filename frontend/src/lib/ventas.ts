import type { Gasto, Lote, Venta } from '../types';

export type ResumenVentas = {
  vendidas: number; // cabezas que ya salieron del lote
  enFinca: number; // cabezas que quedan cebandose
  cerrado: boolean; // se vendio todo lo que se compro
  ingresos: number; // suma de lo recibido (neto) por todas las salidas
  invertido: number; // compra + gastos de ceba
  utilidad: number; // ingresos − invertido (solo tiene sentido con el lote cerrado)
};

// Cuántas cabezas quedan y cómo va la plata. El lote guarda la COMPRA y no se
// toca al vender: la cantidad comprada sigue siendo 22 aunque ya hayan salido 8.
export function resumenVentas(
  lote: Pick<Lote, 'cantidad' | 'valorAPagar'>,
  ventas: Pick<Venta, 'cantidad' | 'valorRecibido'>[],
  gastos: Pick<Gasto, 'monto'>[] = [],
): ResumenVentas {
  const vendidas = ventas.reduce((s, v) => s + v.cantidad, 0);
  const enFinca = Math.max(0, lote.cantidad - vendidas);
  const ingresos = ventas.reduce((s, v) => s + Number(v.valorRecibido), 0);
  const invertido = Number(lote.valorAPagar) + gastos.reduce((s, g) => s + Number(g.monto), 0);

  return {
    vendidas,
    enFinca,
    cerrado: vendidas > 0 && enFinca === 0,
    ingresos,
    invertido,
    utilidad: ingresos - invertido,
  };
}

// $/kg de una salida, cuando se pesó en la báscula.
export function precioPorKg(venta: Pick<Venta, 'pesoTotal' | 'valorTotal'>): number | null {
  const kg = venta.pesoTotal === null ? 0 : Number(venta.pesoTotal);
  if (kg <= 0) return null;
  return Number(venta.valorTotal) / kg;
}

// Utilidad de lo ya vendido en un lote: ingresos − costo de esas cabezas. El costo
// (compra + gastos) se prorratea por cabeza, así una venta parcial también cuenta;
// con el lote cerrado da lo mismo que `resumenVentas().utilidad`.
export function utilidadVendido(
  lote: Pick<Lote, 'cantidad' | 'valorAPagar' | 'cantidadVendida' | 'ingresosVentas' | 'gastosTotal'>,
): number {
  const vendidas = Math.min(lote.cantidadVendida ?? 0, lote.cantidad);
  if (vendidas === 0 || lote.cantidad === 0) return 0;
  const costo = Number(lote.valorAPagar) + (lote.gastosTotal ?? 0);
  return (lote.ingresosVentas ?? 0) - (costo * vendidas) / lote.cantidad;
}
