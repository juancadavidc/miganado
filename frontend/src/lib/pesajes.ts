import type { Lote, Pesaje } from '../types';

const MS_DIA = 86_400_000;

// Una fila de la serie de pesos del lote en el tiempo. El primer punto puede ser
// la COMPRA (peso de entrada) cuando existe; el resto son pesajes en finca.
export type FilaPesaje = {
  id: string | null; // null = compra (no es un pesaje, no se borra)
  fecha: string;
  cantidad: number;
  pesoTotal: number;
  pesoPromedio: number; // por cabeza
  esCompra: boolean;
  notas: string | null;
  diasDesdeAnterior: number | null;
  // Ganancia por cabeza respecto al punto anterior. El número que mira el campo
  // es kgGanados (kilos en el periodo); gmdGramosDia es el dato de apoyo.
  kgGanados: number | null;
  gmdGramosDia: number | null;
};

export type ResumenPesajes = {
  filas: FilaPesaje[];
  ultimoPromedio: number | null; // peso promedio por cabeza más reciente
  kgGanadosDesdeInicio: number | null; // último promedio − promedio del primer punto
  gmdGlobal: number | null; // g/día desde el primer punto hasta el último
  baseDesdeCompra: boolean; // si la serie arranca en la compra
};

function dias(desde: string, hasta: string): number {
  return Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / MS_DIA);
}

export function calcularPesajes(
  lote: Pick<Lote, 'fecha' | 'cantidad' | 'pesoTotal'>,
  pesajes: Pesaje[],
): ResumenPesajes {
  const filas: FilaPesaje[] = [];

  const pesoCompra = Number(lote.pesoTotal);
  const baseDesdeCompra = pesoCompra > 0 && lote.cantidad > 0;
  if (baseDesdeCompra) {
    filas.push({
      id: null,
      fecha: lote.fecha,
      cantidad: lote.cantidad,
      pesoTotal: pesoCompra,
      pesoPromedio: pesoCompra / lote.cantidad,
      esCompra: true,
      notas: null,
      diasDesdeAnterior: null,
      kgGanados: null,
      gmdGramosDia: null,
    });
  }

  const ordenados = [...pesajes].sort(
    (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
  );
  for (const p of ordenados) {
    const pesoTotal = Number(p.pesoTotal);
    filas.push({
      id: p.id,
      fecha: p.fecha,
      cantidad: p.cantidad,
      pesoTotal,
      pesoPromedio: p.cantidad > 0 ? pesoTotal / p.cantidad : 0,
      esCompra: false,
      notas: p.notas,
      diasDesdeAnterior: null,
      kgGanados: null,
      gmdGramosDia: null,
    });
  }

  for (let i = 1; i < filas.length; i++) {
    const prev = filas[i - 1];
    const cur = filas[i];
    const d = dias(prev.fecha, cur.fecha);
    cur.diasDesdeAnterior = d;
    cur.kgGanados = cur.pesoPromedio - prev.pesoPromedio;
    cur.gmdGramosDia = d > 0 ? (cur.kgGanados / d) * 1000 : null;
  }

  const primero = filas[0] ?? null;
  const ultimo = filas.length > 0 ? filas[filas.length - 1] : null;
  let kgGanadosDesdeInicio: number | null = null;
  let gmdGlobal: number | null = null;
  if (primero && ultimo && primero !== ultimo) {
    kgGanadosDesdeInicio = ultimo.pesoPromedio - primero.pesoPromedio;
    const d = dias(primero.fecha, ultimo.fecha);
    gmdGlobal = d > 0 ? (kgGanadosDesdeInicio / d) * 1000 : null;
  }

  return {
    filas,
    ultimoPromedio: ultimo ? ultimo.pesoPromedio : null,
    kgGanadosDesdeInicio,
    gmdGlobal,
    baseDesdeCompra,
  };
}
