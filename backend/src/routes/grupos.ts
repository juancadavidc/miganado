import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const sexoEnum = z.enum(['VP', 'HV', 'HL', 'ML', 'MC', 'TO']);

// Datos del potrero/finca/lote que acompañan a cada grupo en las respuestas, para
// que el front sepa dónde está ubicado el ganado y de qué lote de feria proviene.
const include = {
  potrero: { select: { id: true, nombre: true, fincaId: true, finca: { select: { id: true, nombre: true } } } },
  lote: { select: { id: true, loteNumero: true, numeroFeria: true } },
} as const;

// Verifica que el potrero exista y sea del usuario. Devuelve el potrero o null.
async function potreroDelUsuario(potreroId: string, userId: string) {
  return prisma.potrero.findFirst({ where: { id: potreroId, userId } });
}

// Tras mover/crear/dividir/eliminar grupos, deja el estado ocupado/en descanso del
// potrero coherente con la realidad: ocupado si tiene al menos un grupo encima.
// Solo escribe cuando hay una transición, para no pisar las marcas de tiempo.
async function syncOcupacion(potreroId: string | null) {
  if (!potreroId) return;
  const potrero = await prisma.potrero.findUnique({ where: { id: potreroId } });
  if (!potrero) return;
  const cabezas = await prisma.grupo.count({ where: { potreroId } });
  const ocupado = cabezas > 0;
  if (ocupado === potrero.ocupado) return;
  const now = new Date();
  await prisma.potrero.update({
    where: { id: potreroId },
    data: ocupado
      ? { ocupado: true, ocupadoDesde: now, vacioDesde: null }
      : { ocupado: false, vacioDesde: now, ocupadoDesde: null },
  });
}

const listQuery = z.object({
  fincaId: z.string().min(1).optional(),
  potreroId: z.string().min(1).optional(),
  sinUbicar: z.enum(['true', 'false']).optional(),
});

router.get('/', async (req, res) => {
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { fincaId, potreroId, sinUbicar } = parsed.data;

  const grupos = await prisma.grupo.findMany({
    where: {
      userId: req.user!.userId,
      ...(potreroId ? { potreroId } : {}),
      ...(sinUbicar === 'true' ? { potreroId: null } : {}),
      ...(fincaId ? { potrero: { fincaId } } : {}),
    },
    include,
    orderBy: { createdAt: 'asc' },
  });
  res.json({ grupos });
});

const createSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  sexo: sexoEnum,
  cantidad: z.coerce.number().int().min(1).default(1),
  potreroId: z.string().min(1).optional().nullable(),
  loteId: z.string().min(1).optional().nullable(),
  notas: z.string().optional().nullable(),
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  const userId = req.user!.userId;

  if (d.potreroId) {
    const potrero = await potreroDelUsuario(d.potreroId, userId);
    if (!potrero) return res.status(404).json({ error: 'Potrero no encontrado' });
  }
  if (d.loteId) {
    const lote = await prisma.lote.findFirst({ where: { id: d.loteId, userId } });
    if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });
  }

  const grupo = await prisma.grupo.create({
    data: {
      userId,
      nombre: d.nombre,
      sexo: d.sexo,
      cantidad: d.cantidad,
      potreroId: d.potreroId ?? null,
      ingresoPotrero: d.potreroId ? new Date() : null,
      loteId: d.loteId ?? null,
      notas: d.notas ?? null,
    },
    include,
  });
  await syncOcupacion(grupo.potreroId);
  res.status(201).json({ grupo });
});

const updateSchema = z.object({
  nombre: z.string().trim().min(1).optional(),
  sexo: sexoEnum.optional(),
  cantidad: z.coerce.number().int().min(1).optional(),
  notas: z.string().optional().nullable(),
});

router.put('/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.grupo.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });
  if (!existing) return res.status(404).json({ error: 'Grupo no encontrado' });

  const d = parsed.data;
  const grupo = await prisma.grupo.update({
    where: { id: req.params.id },
    data: {
      ...(d.nombre !== undefined && { nombre: d.nombre }),
      ...(d.sexo !== undefined && { sexo: d.sexo }),
      ...(d.cantidad !== undefined && { cantidad: d.cantidad }),
      ...(d.notas !== undefined && { notas: d.notas }),
    },
    include,
  });
  res.json({ grupo });
});

// Mover/asignar un grupo a un potrero (o sacarlo con potreroId: null). Reinicia el
// contador de días de pastoreo (ingresoPotrero) y sincroniza la ocupación del
// potrero de origen y el de destino.
const moverSchema = z.object({ potreroId: z.string().min(1).nullable() });

router.post('/:id/mover', async (req, res) => {
  const parsed = moverSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const userId = req.user!.userId;

  const existing = await prisma.grupo.findFirst({ where: { id: req.params.id, userId } });
  if (!existing) return res.status(404).json({ error: 'Grupo no encontrado' });

  const destino = parsed.data.potreroId;
  if (destino) {
    const potrero = await potreroDelUsuario(destino, userId);
    if (!potrero) return res.status(404).json({ error: 'Potrero no encontrado' });
  }

  const origen = existing.potreroId;
  const grupo = await prisma.grupo.update({
    where: { id: req.params.id },
    data: { potreroId: destino, ingresoPotrero: destino ? new Date() : null },
    include,
  });
  if (origen !== destino) {
    await syncOcupacion(origen);
    await syncOcupacion(destino);
  }
  res.json({ grupo });
});

// Dividir un grupo: separa `cantidad` cabezas en un grupo nuevo (p.ej. apartar los
// machos para otro potrero). El grupo nuevo va al potrero destino indicado, o se
// queda en el mismo potrero del original si no se especifica.
const dividirSchema = z.object({
  cantidad: z.coerce.number().int().min(1),
  potreroId: z.string().min(1).optional().nullable(),
  nombre: z.string().trim().min(1).optional(),
});

router.post('/:id/dividir', async (req, res) => {
  const parsed = dividirSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const userId = req.user!.userId;
  const d = parsed.data;

  const origen = await prisma.grupo.findFirst({ where: { id: req.params.id, userId } });
  if (!origen) return res.status(404).json({ error: 'Grupo no encontrado' });
  if (d.cantidad >= origen.cantidad) {
    return res.status(400).json({ error: `Debes dejar al menos 1 cabeza en el grupo original (tiene ${origen.cantidad})` });
  }

  // Destino: si no se indica, el grupo nuevo se queda en el potrero del original.
  const destino = d.potreroId === undefined ? origen.potreroId : d.potreroId;
  if (destino) {
    const potrero = await potreroDelUsuario(destino, userId);
    if (!potrero) return res.status(404).json({ error: 'Potrero no encontrado' });
  }

  const [, nuevo] = await prisma.$transaction([
    prisma.grupo.update({
      where: { id: origen.id },
      data: { cantidad: origen.cantidad - d.cantidad },
    }),
    prisma.grupo.create({
      data: {
        userId,
        nombre: d.nombre ?? `${origen.nombre} (separado)`,
        sexo: origen.sexo,
        cantidad: d.cantidad,
        potreroId: destino,
        ingresoPotrero: destino ? new Date() : null,
        loteId: origen.loteId,
      },
      include,
    }),
  ]);
  await syncOcupacion(destino);
  const origenActualizado = await prisma.grupo.findUnique({ where: { id: origen.id }, include });
  res.status(201).json({ grupo: origenActualizado, nuevo });
});

// Fusionar dos grupos en uno (juntar dos puntas). Solo se permite si están en el
// mismo potrero y son del mismo sexo, porque físicamente pastan juntos. El grupo
// indicado en :id absorbe al otro y conserva la fecha de ingreso más antigua.
const fusionarSchema = z.object({ otroGrupoId: z.string().min(1) });

router.post('/:id/fusionar', async (req, res) => {
  const parsed = fusionarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const userId = req.user!.userId;

  if (parsed.data.otroGrupoId === req.params.id) {
    return res.status(400).json({ error: 'No puedes fusionar un grupo consigo mismo' });
  }

  const [destino, otro] = await Promise.all([
    prisma.grupo.findFirst({ where: { id: req.params.id, userId } }),
    prisma.grupo.findFirst({ where: { id: parsed.data.otroGrupoId, userId } }),
  ]);
  if (!destino || !otro) return res.status(404).json({ error: 'Grupo no encontrado' });
  if (destino.sexo !== otro.sexo) {
    return res.status(400).json({ error: 'Solo se pueden fusionar grupos del mismo sexo' });
  }
  if (destino.potreroId !== otro.potreroId) {
    return res.status(400).json({ error: 'Ambos grupos deben estar en el mismo potrero para fusionarse' });
  }

  // Fecha de ingreso al potrero: la más antigua de las dos (días de pastoreo reales).
  const fechas = [destino.ingresoPotrero, otro.ingresoPotrero].filter((f): f is Date => f !== null);
  const ingresoPotrero = fechas.length ? new Date(Math.min(...fechas.map((f) => f.getTime()))) : null;

  const [grupo] = await prisma.$transaction([
    prisma.grupo.update({
      where: { id: destino.id },
      data: {
        cantidad: destino.cantidad + otro.cantidad,
        ingresoPotrero,
        loteId: destino.loteId === otro.loteId ? destino.loteId : null,
      },
      include,
    }),
    prisma.grupo.delete({ where: { id: otro.id } }),
  ]);
  res.json({ grupo });
});

router.delete('/:id', async (req, res) => {
  const existing = await prisma.grupo.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });
  if (!existing) return res.status(404).json({ error: 'Grupo no encontrado' });
  await prisma.grupo.delete({ where: { id: req.params.id } });
  await syncOcupacion(existing.potreroId);
  res.status(204).end();
});

export default router;
