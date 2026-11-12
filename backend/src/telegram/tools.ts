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
        animales: l.animales.map((a: any) => ({
          id: a.id, identificador: a.identificador, sexo: a.sexo, peso: n(a.peso), notas: a.notas,
          ...(a.esCria && { esCria: true, madreId: a.madreId, nacimiento: dia(a.nacimiento), destetada: dia(a.destetadoAt) }),
          ...(a.muerteFecha && { murio: dia(a.muerteFecha) }),
        })),
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
      name: 'actualizar_animal',
      description: 'Corrige un animal individual: sexo (p. ej. pasar una VP a HV cuando el dueño lo confirme), peso, marca o notas.',
      input_schema: {
        type: 'object',
        properties: {
          animalId: { type: 'string' },
          sexo: { type: 'string', enum: SEXOS },
          peso: { type: 'number' },
          identificador: { type: 'string' },
          notas: { type: 'string' },
        },
        required: ['animalId'],
      },
    },
    run: async (u, { animalId, ...i }) => api(u, 'PUT', `/api/animales/${encodeURIComponent(animalId)}`, i),
  },
  {
    def: {
      name: 'registrar_cria',
      description:
        'Registra una cría al pie: pegada a su madre (madreId, una VP/HV registrada en el lote) o solo al lote si las vacas no están registradas una por una. Una vaca puede tener mellizos (dos crías). No cambia a la madre.',
      input_schema: {
        type: 'object',
        properties: {
          loteId: { type: 'string' },
          madreId: { type: 'string' },
          sexo: { type: 'string', enum: ['M', 'H'] },
          nacimiento: { ...FECHA, description: 'Fecha en que nació, o en que llegó si vino con la vaca' },
          vinoConMadre: { type: 'boolean', description: 'true si vino con la vaca en la compra' },
          peso: { type: 'number' },
          identificador: { type: 'string', description: 'Marca o nombre, si tiene' },
          notas: { type: 'string' },
        },
        required: ['loteId', 'sexo'],
      },
    },
    run: async (u, i) => api(u, 'POST', '/api/crias', i),
  },
  {
    def: {
      name: 'listar_crias',
      description:
        'Crías de una finca o de un lote con su madre, lote, nacimiento y estado (AL_PIE, DESTETADA, VENDIDA, MUERTA). Úsala para saber qué crías hay antes de venderlas o actualizarlas.',
      input_schema: {
        type: 'object',
        properties: { fincaId: { type: 'string' }, loteId: { type: 'string' } },
      },
    },
    run: async (u, i) => {
      const q = new URLSearchParams(Object.entries(i).filter(([, v]) => v) as [string, string][]);
      const { crias } = (await api(u, 'GET', `/api/crias?${q}`)) as any;
      return crias.map((c: any) => ({
        id: c.id,
        identificador: c.identificador,
        sexo: c.sexo === 'HL' ? 'hembra' : 'macho',
        estado: c.estado,
        nacimiento: dia(c.nacimiento),
        vinoConMadre: c.vinoConMadre,
        peso: n(c.peso),
        madre: c.madre ? { id: c.madre.id, identificador: c.madre.identificador, sexo: c.madre.sexo } : null,
        loteId: c.lote.id,
        loteNumero: c.lote.loteNumero,
        ...(c.venta && { vendida: { fecha: dia(c.venta.fecha), recibido: n(c.venta.valorRecibido) } }),
      }));
    },
  },
  {
    def: {
      name: 'actualizar_cria',
      description:
        'Actualiza una cría: peso, marca, fecha de nacimiento, destete (destetadoAt: deja de estar al pie y queda de levante en el lote) o muerte (muerteFecha + nota de qué murió; deja nota también en la madre). Si la respuesta trae madresSinCria, pregunta al usuario si pasa esas vacas de VP a HV.',
      input_schema: {
        type: 'object',
        properties: {
          criaId: { type: 'string' },
          peso: { type: 'number' },
          identificador: { type: 'string' },
          nacimiento: FECHA,
          destetadoAt: FECHA,
          muerteFecha: FECHA,
          nota: { type: 'string' },
        },
        required: ['criaId'],
      },
    },
    run: async (u, { criaId, ...i }) => api(u, 'PATCH', `/api/crias/${encodeURIComponent(criaId)}`, i),
  },
  {
    def: {
      name: 'registrar_venta_crias',
      description:
        'Vende varias crías en una salida (solo el dueño) y reparte la plata entre sus lotes: una venta por cría. Formas de dar el valor: (a) valor de cada cría en crias[].valor; (b) valorTotal sin precios exactos → se reparte parejo entre las crías sin valor; (c) al kilo con precioKilo + kilos de cada cría o pesoTotal (lo que falte se reparte parejo). La deducción se reparte según la plata de cada cría. Antes de llamarla muestra el reparto al usuario y espera su "sí". Si la respuesta trae madresSinCria, pregunta si pasa esas vacas de VP a HV.',
      input_schema: {
        type: 'object',
        properties: {
          fecha: FECHA,
          crias: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              properties: { criaId: { type: 'string' }, valor: { type: 'number' }, kilos: { type: 'number' } },
              required: ['criaId'],
            },
          },
          valorTotal: { type: 'number' },
          precioKilo: { type: 'number' },
          pesoTotal: { type: 'number' },
          deduccion: { type: 'number', description: 'Comisión, báscula, etc. del total' },
          comprador: { type: 'string' },
          notas: { type: 'string' },
        },
        required: ['fecha', 'crias'],
      },
    },
    run: async (u, i) => api(u, 'POST', '/api/crias/venta', i),
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
