import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { esDueno, lotesVisiblesWhere, puedeOperar, rolesEnFincaDeLote } from '../lib/fincaAccess.js';

// Crías al pie de las vacas paridas. Una cría no es una cabeza comprada: vive en el
// lote (pegada a su madre si está registrada) y su venta suma plata al lote sin
// descontarle cabezas. Se desteta (queda de levante en el lote), se muere o se vende,
// casi siempre varias a la vez y por cabeza, repartiendo la plata entre los lotes.
const router = Router();
router.use(requireAuth);

const fechaSchema = z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

function estadoCria(a: { muerteFecha: Date | null; destetadoAt: Date | null; venta: { id: string } | null }) {
  if (a.venta) return 'VENDIDA';
  if (a.muerteFecha) return 'MUERTA';
  if (a.destetadoAt) return 'DESTETADA';
  return 'AL_PIE';
}

// Madres que se quedaron sin ninguna cría al pie: el agente le pregunta al dueño si
// pasarlas de VP a HV (no se hace solo: una vaca que vende o pierde la cría puede
// seguir siendo de cría).
async function madresSinCriaAlPie(madreIds: (string | null)[]) {
  const ids = [...new Set(madreIds.filter((x): x is string => !!x))];
  if (ids.length === 0) return [];
  const madres = await prisma.animal.findMany({
    where: { id: { in: ids }, sexo: 'VP', venta: null, muerteFecha: null },
    select: {
      id: true,
      identificador: true,
      loteId: true,
      crias: { where: { venta: null, muerteFecha: null, destetadoAt: null }, select: { id: true } },
    },
  });
  return madres.filter((m) => m.crias.length === 0).map(({ crias, ...m }) => m);
}

// Reparte `totalCent` en partes proporcionales a `pesos`, exacto al centavo (mayor
// resto): la suma de las partes siempre da el total.
function repartir(totalCent: number, pesos: number[]): number[] {
  const suma = pesos.reduce((s, p) => s + p, 0);
  const base = suma > 0 ? pesos : pesos.map(() => 1);
  const total = base.reduce((s, p) => s + p, 0);
  const partes = base.map((p, i) => {
    const exacto = (totalCent * p) / total;
    return { i, cent: Math.floor(exacto), resto: exacto - Math.floor(exacto) };
  });
  let sobrante = totalCent - partes.reduce((s, p) => s + p.cent, 0);
  for (const p of [...partes].sort((a, b) => b.resto - a.resto)) {
    if (sobrante-- <= 0) break;
    p.cent += 1;
  }
  return partes.map((p) => p.cent);
}

router.get('/', async (req, res) => {
  const parsed = z.object({ fincaId: z.string().optional(), loteId: z.string().optional() }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { fincaId, loteId } = parsed.data;

  const crias = await prisma.animal.findMany({
    where: {
      esCria: true,
      ...(loteId && { loteId }),
      lote: { ...lotesVisiblesWhere(req.user!.userId), ...(fincaId && { fincaId }) },
    },
    orderBy: { createdAt: 'asc' },
    include: {
      venta: { select: { id: true, fecha: true, valorRecibido: true } },
      madre: { select: { id: true, identificador: true, sexo: true } },
      lote: { select: { id: true, loteNumero: true, fincaId: true } },
    },
  });
  res.json({
    crias: crias.map((c) => ({
      id: c.id,
      identificador: c.identificador,
      sexo: c.sexo,
      peso: c.peso,
      nacimiento: c.nacimiento,
      vinoConMadre: c.vinoConMadre,
      estado: estadoCria(c),
      destetadoAt: c.destetadoAt,
      muerteFecha: c.muerteFecha,
      venta: c.venta,
      madre: c.madre,
      lote: c.lote,
    })),
  });
});

const crearSchema = z.object({
  loteId: z.string().min(1),
  madreId: z.string().min(1).optional().nullable(),
  sexo: z.enum(['M', 'H']),
  nacimiento: fechaSchema.optional().nullable(),
  vinoConMadre: z.boolean().default(false),
  peso: z.coerce.number().positive().optional().nullable(),
  identificador: z.string().optional().nullable(),
  notas: z.string().optional().nullable(),
});

router.post('/', async (req, res) => {
  const parsed = crearSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;

  // Registrar crías es trabajo del día a día: dueño o cuidador.
  if (!(await rolesEnFincaDeLote(req.user!.userId, d.loteId))) {
    return res.status(404).json({ error: 'Lote no encontrado' });
  }
  let madre = null;
  if (d.madreId) {
    madre = await prisma.animal.findUnique({
      where: { id: d.madreId },
      select: { loteId: true, sexo: true, identificador: true, venta: { select: { id: true } }, muerteFecha: true },
    });
    if (!madre || madre.loteId !== d.loteId) return res.status(404).json({ error: 'La madre no está en ese lote' });
    if (madre.venta || madre.muerteFecha) return res.status(409).json({ error: 'Esa vaca ya no está en la finca' });
    if (!['VP', 'HV'].includes(madre.sexo)) return res.status(409).json({ error: 'La madre debe ser una vaca (VP o HV)' });
  }

  const cria = await prisma.animal.create({
    data: {
      loteId: d.loteId,
      madreId: d.madreId ?? null,
      esCria: true,
      sexo: d.sexo === 'H' ? 'HL' : 'ML',
      nacimiento: d.nacimiento ? new Date(d.nacimiento) : null,
      vinoConMadre: d.vinoConMadre,
      peso: d.peso ?? null,
      identificador: d.identificador || (madre?.identificador ? `Cría de ${madre.identificador}` : null),
      notas: d.notas ?? null,
    },
  });
  res.status(201).json({ cria });
});

const actualizarSchema = z.object({
  peso: z.coerce.number().positive().optional().nullable(),
  identificador: z.string().optional().nullable(),
  nacimiento: fechaSchema.optional().nullable(),
  destetadoAt: fechaSchema.optional().nullable(),
  muerteFecha: fechaSchema.optional().nullable(),
  nota: z.string().optional().nullable(), // p. ej. de qué murió
});

router.patch('/:id', async (req, res) => {
  const parsed = actualizarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;

  const cria = await prisma.animal.findUnique({
    where: { id: req.params.id },
    include: {
      venta: { select: { id: true } },
      lote: { select: { finca: { select: { duenoId: true, cuidadorId: true } } } },
    },
  });
  if (!cria || !cria.esCria || !puedeOperar(cria.lote.finca, req.user!.userId)) {
    return res.status(404).json({ error: 'Cría no encontrada' });
  }
  if (cria.venta && (d.muerteFecha || d.destetadoAt)) {
    return res.status(409).json({ error: 'Esa cría ya está vendida' });
  }

  const actualizada = await prisma.$transaction(async (tx) => {
    const a = await tx.animal.update({
      where: { id: cria.id },
      data: {
        ...(d.peso !== undefined && { peso: d.peso }),
        ...(d.identificador !== undefined && { identificador: d.identificador }),
        ...(d.nacimiento !== undefined && { nacimiento: d.nacimiento ? new Date(d.nacimiento) : null }),
        ...(d.destetadoAt !== undefined && { destetadoAt: d.destetadoAt ? new Date(d.destetadoAt) : null }),
        ...(d.muerteFecha !== undefined && { muerteFecha: d.muerteFecha ? new Date(d.muerteFecha) : null }),
      },
    });
    if (d.muerteFecha) {
      const dia = d.muerteFecha.slice(0, 10);
      const texto = `Murió el ${dia}${d.nota ? `: ${d.nota}` : ''}`;
      await tx.anotacion.create({ data: { animalId: cria.id, texto } });
      // En la madre queda la huella: una vaca que pierde crías seguido es de descarte.
      if (cria.madreId) {
        await tx.anotacion.create({ data: { animalId: cria.madreId, texto: `Perdió su cría el ${dia}${d.nota ? `: ${d.nota}` : ''}` } });
      }
    } else if (d.nota) {
      await tx.anotacion.create({ data: { animalId: cria.id, texto: d.nota } });
    }
    return a;
  });

  const salioDelPie = !!(d.muerteFecha || d.destetadoAt);
  res.json({ cria: actualizada, madresSinCria: salioDelPie ? await madresSinCriaAlPie([cria.madreId]) : [] });
});

// Venta de varias crías en una sola salida ("vendí 4 crías por 7 millones"). Crea
// una Venta por cría, en su lote, y reparte la plata:
// - con precioKilo: kilos de cada cría (los que falten salen parejo de pesoTotal) × $/kg;
// - si no, cada cría con `valor` lleva ese precio y el resto de valorTotal se reparte
//   parejo entre las demás (el caso de "no hubo precios exactos").
// La deducción (comisión, flete de la feria) se reparte según la plata de cada cría.
const ventaSchema = z.object({
  fecha: fechaSchema,
  crias: z
    .array(z.object({
      criaId: z.string().min(1),
      valor: z.coerce.number().min(0).optional(),
      kilos: z.coerce.number().positive().optional(),
    }))
    .min(1),
  valorTotal: z.coerce.number().min(0).optional(),
  precioKilo: z.coerce.number().positive().optional(),
  pesoTotal: z.coerce.number().positive().optional(),
  deduccion: z.coerce.number().min(0).default(0),
  comprador: z.string().optional().nullable(),
  notas: z.string().optional().nullable(),
});

router.post('/venta', async (req, res) => {
  const parsed = ventaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  const ids = d.crias.map((c) => c.criaId);
  if (new Set(ids).size !== ids.length) return res.status(400).json({ error: 'Una cría está repetida' });

  const crias = await prisma.animal.findMany({
    where: { id: { in: ids }, esCria: true, lote: lotesVisiblesWhere(req.user!.userId) },
    include: {
      venta: { select: { id: true } },
      lote: { select: { id: true, loteNumero: true, finca: { select: { duenoId: true, cuidadorId: true } } } },
    },
  });
  if (crias.length !== ids.length) return res.status(404).json({ error: 'Una o más crías no existen' });
  // Vender es plata: como las demás ventas, solo la registra el dueño.
  if (!crias.every((c) => esDueno(c.lote.finca, req.user!.userId))) {
    return res.status(403).json({ error: 'Solo el dueño puede registrar ventas' });
  }
  const noDisponible = crias.find((c) => c.venta || c.muerteFecha);
  if (noDisponible) {
    const cual = noDisponible.identificador ?? 'seleccionada';
    return res.status(409).json({ error: noDisponible.venta ? `La cría ${cual} ya está vendida` : `La cría ${cual} está registrada como muerta` });
  }

  const porId = new Map(crias.map((c) => [c.id, c]));
  const items = d.crias.map((it) => ({ ...it, cria: porId.get(it.criaId)! }));

  // Valor bruto de cada cría, en centavos, y kilos si se vendió al kilo.
  let valores: number[];
  let kilos: (number | null)[] = items.map((it) => it.kilos ?? null);
  if (d.precioKilo) {
    const faltan = items.filter((it) => it.kilos == null).length;
    if (faltan > 0) {
      if (!d.pesoTotal) return res.status(400).json({ error: 'Faltan los kilos: dime el peso total o el de cada cría' });
      const conocidos = items.reduce((s, it) => s + (it.kilos ?? 0), 0);
      const resto = d.pesoTotal - conocidos;
      if (resto <= 0) return res.status(400).json({ error: 'El peso total no alcanza para las crías sin peso' });
      const partes = repartir(Math.round(resto * 100), items.filter((it) => it.kilos == null).map(() => 1));
      let k = 0;
      kilos = items.map((it) => it.kilos ?? partes[k++] / 100);
    }
    valores = kilos.map((kg) => Math.round(kg! * d.precioKilo! * 100));
  } else {
    const fijos = items.reduce((s, it) => s + Math.round((it.valor ?? 0) * 100), 0);
    const sinPrecio = items.filter((it) => it.valor == null);
    if (sinPrecio.length > 0) {
      if (d.valorTotal == null) return res.status(400).json({ error: 'Falta el valor total o el precio de cada cría' });
      const resto = Math.round(d.valorTotal * 100) - fijos;
      if (resto < 0) return res.status(400).json({ error: 'Los precios por cría suman más que el total' });
      const partes = repartir(resto, sinPrecio.map(() => 1));
      let k = 0;
      valores = items.map((it) => (it.valor != null ? Math.round(it.valor * 100) : partes[k++]));
    } else {
      if (d.valorTotal != null && Math.round(d.valorTotal * 100) !== fijos) {
        return res.status(400).json({ error: `Los precios por cría suman ${fijos / 100}, no ${d.valorTotal}` });
      }
      valores = items.map((it) => Math.round(it.valor! * 100));
    }
  }
  const deducciones = repartir(Math.round(d.deduccion * 100), valores);

  const fecha = new Date(d.fecha);
  const ventas = await prisma.$transaction(
    items.map((it, i) =>
      prisma.venta.create({
        data: {
          loteId: it.cria.loteId,
          animalId: it.cria.id,
          fecha,
          cantidad: 0, // la cría no fue una cabeza comprada
          pesoTotal: kilos[i],
          valorTotal: valores[i] / 100,
          deduccion: deducciones[i] / 100,
          valorRecibido: (valores[i] - deducciones[i]) / 100,
          comprador: d.comprador ?? null,
          notas: d.notas ?? null,
        },
      }),
    ),
  );

  const reparto = new Map<string, { loteId: string; loteNumero: string | null; crias: number; valor: number; deduccion: number; recibido: number }>();
  items.forEach((it, i) => {
    const r = reparto.get(it.cria.loteId) ?? { loteId: it.cria.loteId, loteNumero: it.cria.lote.loteNumero, crias: 0, valor: 0, deduccion: 0, recibido: 0 };
    r.crias += 1;
    r.valor += valores[i]; // en centavos hasta el final, para no arrastrar decimales
    r.deduccion += deducciones[i];
    r.recibido += valores[i] - deducciones[i];
    reparto.set(it.cria.loteId, r);
  });

  res.status(201).json({
    ventas,
    reparto: [...reparto.values()].map((r) => ({ ...r, valor: r.valor / 100, deduccion: r.deduccion / 100, recibido: r.recibido / 100 })),
    madresSinCria: await madresSinCriaAlPie(items.map((it) => it.cria.madreId)),
  });
});

export default router;
