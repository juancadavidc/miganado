import type Anthropic from '@anthropic-ai/sdk';
import { env } from '../lib/env.js';
import { signToken } from '../middleware/auth.js';

// Las tools del agente NO tocan la base directo: llaman a la misma API REST que usa
// la app web, firmando un token del usuario vinculado. Así heredan validaciones y
// permisos (dueño vs cuidador) sin duplicar reglas de negocio.

export type Usuario = { userId: string; documento: string };

async function api(u: Usuario, method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`http://127.0.0.1:${env.PORT}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${signToken(u)}`,
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return { ok: true };
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : JSON.stringify(data?.error ?? data));
  return data;
}

const n = (v: unknown) => (v == null ? null : Number(v));
const dia = (v: unknown) => (v ? String(v).slice(0, 10) : null);

const TIPOS_GASTO = [
  'TRANSPORTE', 'COMISION_CUIDADOR', 'VACUNAS', 'DESPARASITANTE', 'MEDICAMENTOS',
  'ALIMENTACION', 'ARRIENDO_PASTO', 'JORNALES', 'DOCUMENTOS', 'OTRO',
];
const SEXOS = ['VP', 'HV', 'HL', 'ML', 'MC', 'TO'];
const FECHA = { type: 'string', description: 'Fecha YYYY-MM-DD' } as const;

type Tool = {
  def: Anthropic.Tool;
  run: (u: Usuario, input: any) => Promise<unknown>;
};

const tools: Tool[] = [
  {
    def: {
      name: 'listar_fincas',
      description: 'Lista las fincas del usuario (propias y las que cuida) con su rol en cada una.',
      input_schema: { type: 'object', properties: {} },
    },
    run: async (u) => {
      const { fincas } = (await api(u, 'GET', '/api/fincas')) as any;
      return fincas.map((f: any) => ({
        id: f.id,
        nombre: f.nombre,
        rol: f.duenoId === u.userId ? 'DUENO' : 'CUIDADOR',
        potreros: f._count?.potreros,
        lotes: f._count?.lotes,
      }));
    },
  },
  {
    def: {
      name: 'ver_finca',
      description:
        'Foto de hoy de una finca: sus potreros (ocupado o en descanso) y los lotes que siguen en finca con cabezas, sexo, peso actual y en qué potrero están. Úsala para resolver nombres de potreros y lotes a ids.',
      input_schema: { type: 'object', properties: { fincaId: { type: 'string' } }, required: ['fincaId'] },
    },
    run: async (u, i) => {
      const d = (await api(u, 'GET', `/api/mapa?fincaId=${encodeURIComponent(i.fincaId)}`)) as any;
      return {
        finca: d.finca.nombre,
        potreros: d.potreros.map((p: any) => ({
          id: p.id,
          nombre: p.nombre,
          estado: p.ocupado ? 'ocupado' : 'descanso',
          desde: dia(p.ocupado ? p.ocupadoDesde : p.vacioDesde),
          metadatos: p.metadatos,
        })),
        lotes: d.lotes.map((l: any) => ({
          id: l.id,
          loteNumero: l.loteNumero,
          compra: dia(l.fecha),
          sexo: l.sexo,
          cabezas: l.cabezas,
          compradas: l.cantidad,
          pesoActualKg: l.pesoActual && Math.round(l.pesoActual),
          potreroId: l.potreroId,
          animalesIndividuales: l.animales.length,
        })),
        linkMapa: `${env.APP_URL}/mapa/${d.finca.id}`,
      };
    },
  },
  {
    def: {
      name: 'listar_lotes',
      description: 'Lista todos los lotes del usuario con cabezas compradas/vendidas, gastos y lo que se debe.',
      input_schema: { type: 'object', properties: {} },
    },
    run: async (u) => {
      const { lotes } = (await api(u, 'GET', '/api/lotes')) as any;
      return lotes.map((l: any) => ({
        id: l.id,
        finca: l.finca?.nombre,
        loteNumero: l.loteNumero,
        compra: dia(l.fecha),
        sexo: l.sexo,
        compradas: l.cantidad,
        vendidas: l.cantidadVendida,
        valorAPagar: n(l.valorAPagar),
        gastosTotal: l.gastosTotal,
        gastosPendiente: l.gastosPendiente,
        ingresosVentas: l.ingresosVentas,
      }));
    },
  },
  {
    def: {
      name: 'ver_lote',
      description: 'Detalle de un lote: compra, pesajes, gastos (con id y si están pagados), ventas, animales y anotaciones.',
      input_schema: { type: 'object', properties: { loteId: { type: 'string' } }, required: ['loteId'] },
    },
    run: async (u, i) => {
      const { lote: l } = (await api(u, 'GET', `/api/lotes/${encodeURIComponent(i.loteId)}`)) as any;
      return {
        id: l.id,
        finca: l.finca?.nombre,
        loteNumero: l.loteNumero,
        numeroFeria: l.numeroFeria,
        compra: { fecha: dia(l.fecha), sexo: l.sexo, cantidad: l.cantidad, pesoTotal: n(l.pesoTotal), valorFinalKg: n(l.valorFinal), valorAPagar: n(l.valorAPagar) },
        potreroId: l.potreroId,
        pesajes: l.pesajes.map((p: any) => ({ id: p.id, fecha: dia(p.fecha), cantidad: p.cantidad, pesoTotal: n(p.pesoTotal) })),
        gastos: l.gastos.map((g: any) => ({ id: g.id, fecha: dia(g.fecha), tipo: g.tipo, descripcion: g.descripcion, monto: n(g.monto), pagado: g.pagado })),
        ventas: l.ventas.map((v: any) => ({ id: v.id, fecha: dia(v.fecha), cantidad: v.cantidad, pesoTotal: n(v.pesoTotal), valorRecibido: n(v.valorRecibido), comprador: v.comprador, animalId: v.animalId })),
        animales: l.animales.map((a: any) => ({ id: a.id, identificador: a.identificador, sexo: a.sexo, peso: n(a.peso), madreId: a.madreId, notas: a.notas })),
        anotaciones: l.anotaciones.map((a: any) => ({ id: a.id, fecha: dia(a.createdAt), texto: a.texto })),
        notas: l.notas,
      };
    },
  },
  {
    def: {
      name: 'crear_lote',
      description: 'Registra la compra de un lote de ganado en una finca.',
      input_schema: {
        type: 'object',
        properties: {
          fincaId: { type: 'string' },
          fecha: FECHA,
          sexo: { type: 'string', enum: SEXOS },
          cantidad: { type: 'integer', minimum: 1 },
          pesoTotal: { type: 'number', description: 'Kilos totales de la compra (0 si se compró por cabeza)' },
          valorFinal: { type: 'number', description: 'Precio por kilo de la compra' },
          valorTotal: { type: 'number' },
          deduccion: { type: 'number' },
          valorAPagar: { type: 'number', description: 'Lo que se pagó por el lote' },
          loteNumero: { type: 'string' },
          numeroFeria: { type: 'string' },
          notas: { type: 'string' },
        },
        required: ['fincaId', 'fecha', 'sexo', 'cantidad'],
      },
    },
    run: async (u, i) => api(u, 'POST', '/api/lotes', i),
  },
  {
    def: {
      name: 'registrar_pesaje',
      description: 'Registra un pesaje del grupo: cuántas cabezas se pesaron y el peso total en kg.',
      input_schema: {
        type: 'object',
        properties: {
          loteId: { type: 'string' },
          fecha: FECHA,
          cantidad: { type: 'integer', minimum: 1 },
          pesoTotal: { type: 'number' },
          notas: { type: 'string' },
        },
        required: ['loteId', 'fecha', 'cantidad', 'pesoTotal'],
      },
    },
    run: async (u, i) => api(u, 'POST', '/api/pesajes', i),
  },
  {
    def: {
      name: 'registrar_gasto',
      description: 'Registra un gasto de UN lote. Para un flete compartido por varios lotes usa registrar_flete.',
      input_schema: {
        type: 'object',
        properties: {
          loteId: { type: 'string' },
          tipo: { type: 'string', enum: TIPOS_GASTO },
          monto: { type: 'number' },
          pagado: { type: 'boolean', description: 'false si se debe (p. ej. comisión del cuidador)' },
          fecha: FECHA,
          descripcion: { type: 'string', description: 'Detalle; obligatorio si tipo=OTRO' },
        },
        required: ['loteId', 'tipo', 'monto'],
      },
    },
    run: async (u, i) => api(u, 'POST', '/api/gastos', i),
  },
  {
    def: {
      name: 'registrar_flete',
      description:
        'Gasto de transporte de un viaje que llevó varios lotes juntos: reparte el monto total por cabeza entre los lotes y crea un gasto TRANSPORTE en cada uno.',
      input_schema: {
        type: 'object',
        properties: {
          loteIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
          montoTotal: { type: 'number' },
          fecha: FECHA,
          descripcion: { type: 'string' },
        },
        required: ['loteIds', 'montoTotal'],
      },
    },
    run: async (u, i) => api(u, 'POST', '/api/bulk/gastos-transporte', i),
  },
  {
    def: {
      name: 'marcar_gasto_pagado',
      description: 'Marca un gasto como pagado o pendiente (solo el dueño).',
      input_schema: {
        type: 'object',
        properties: { gastoId: { type: 'string' }, pagado: { type: 'boolean' } },
        required: ['gastoId', 'pagado'],
      },
    },
    run: async (u, i) => api(u, 'PATCH', `/api/gastos/${encodeURIComponent(i.gastoId)}`, { pagado: i.pagado }),
  },
  {
    def: {
      name: 'registrar_venta',
      description:
        'Registra una salida (venta) del lote, total o parcial, al kilo. Solo el dueño. Con animalId vende ese animal individual.',
      input_schema: {
        type: 'object',
        properties: {
          loteId: { type: 'string' },
          animalId: { type: 'string' },
          fecha: FECHA,
          cantidad: { type: 'integer', minimum: 1 },
          pesoTotal: { type: 'number', description: 'Kilos de salida' },
          valorTotal: { type: 'number', description: 'Bruto (kilos × $/kg)' },
          deduccion: { type: 'number', description: 'Comisión, báscula' },
          comprador: { type: 'string' },
          notas: { type: 'string' },
        },
        required: ['loteId', 'fecha', 'cantidad', 'valorTotal'],
      },
    },
    run: async (u, i) =>
      api(u, 'POST', '/api/ventas', { ...i, valorRecibido: Math.max(0, i.valorTotal - (i.deduccion ?? 0)) }),
  },
  {
    def: {
      name: 'mover_lote',
      description: 'Mueve un lote a otro potrero de su finca (potreroId null = sacarlo de potrero). Actualiza ocupado/descanso.',
      input_schema: {
        type: 'object',
        properties: { loteId: { type: 'string' }, potreroId: { type: ['string', 'null'] } },
        required: ['loteId', 'potreroId'],
      },
    },
    run: async (u, i) => api(u, 'POST', `/api/lotes/${encodeURIComponent(i.loteId)}/mover`, { potreroId: i.potreroId }),
  },
  {
    def: {
      name: 'crear_potrero',
      description: 'Crea un potrero en una finca. metadatos: pares libres (área, pasto, agua…).',
      input_schema: {
        type: 'object',
        properties: {
          fincaId: { type: 'string' },
          nombre: { type: 'string' },
          notas: { type: 'string' },
          metadatos: { type: 'object', additionalProperties: { type: 'string' } },
        },
        required: ['fincaId', 'nombre'],
      },
    },
    run: async (u, i) => api(u, 'POST', '/api/potreros', i),
  },
  {
    def: {
      name: 'registrar_animal',
      description: 'Registra un animal individual dentro de un lote (enfermo en tratamiento, uno con orejera, etc.).',
      input_schema: {
        type: 'object',
        properties: {
          loteId: { type: 'string' },
          identificador: { type: 'string' },
          sexo: { type: 'string', enum: SEXOS },
          peso: { type: 'number' },
          notas: { type: 'string' },
        },
        required: ['loteId', 'sexo'],
      },
    },
    run: async (u, i) => api(u, 'POST', '/api/animales', i),
  },
  {
    def: {
      name: 'agregar_anotacion',
      description: 'Deja una nota de texto en un lote o en un animal.',
      input_schema: {
        type: 'object',
        properties: { loteId: { type: 'string' }, animalId: { type: 'string' }, texto: { type: 'string' } },
        required: ['texto'],
      },
    },
    run: async (u, i) => api(u, 'POST', '/api/anotaciones', i),
  },
  {
    def: {
      name: 'eliminar_registro',
      description: 'Borra un registro por id. Solo después de que el usuario lo confirme explícitamente.',
      input_schema: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['gasto', 'pesaje', 'venta', 'anotacion', 'animal'] },
          id: { type: 'string' },
        },
        required: ['tipo', 'id'],
      },
    },
    run: async (u, i) => {
      const ruta = { gasto: 'gastos', pesaje: 'pesajes', venta: 'ventas', anotacion: 'anotaciones', animal: 'animales' }[
        i.tipo as 'gasto'
      ];
      return api(u, 'DELETE', `/api/${ruta}/${encodeURIComponent(i.id)}`);
    },
  },
];

export const toolDefs: Anthropic.Tool[] = tools.map((t) => t.def);

export async function ejecutarTool(u: Usuario, nombre: string, input: unknown): Promise<string> {
  const tool = tools.find((t) => t.def.name === nombre);
  if (!tool) throw new Error(`Tool desconocida: ${nombre}`);
  return JSON.stringify(await tool.run(u, input ?? {}));
}
