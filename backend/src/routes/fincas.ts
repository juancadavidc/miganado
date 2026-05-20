import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const propiedadesSchema = z.record(z.string(), z.string());

// La capacidad define el ancho del mapa en columnas y es fija al crear la finca.
const capacidadSchema = z.union([z.literal(16), z.literal(32), z.literal(64)]);

const createSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  capacidad: capacidadSchema,
  propiedades: propiedadesSchema.optional().nullable(),
});

const updateSchema = z.object({
  nombre: z.string().trim().min(1).optional(),
  propiedades: propiedadesSchema.optional().nullable(),
});

// Limpia el mapa de propiedades: descarta pares con clave o valor vacíos. Devuelve
// el objeto saneado, o Prisma.DbNull para guardar NULL cuando queda vacío (un campo
// Json? de Prisma no acepta `null` de JS directamente).
function normalizePropiedades(
  raw: Record<string, string> | null | undefined,
): Prisma.InputJsonObject | typeof Prisma.DbNull | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return Prisma.DbNull;
  const limpio: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const clave = k.trim();
    const valor = (v ?? '').trim();
    if (clave && valor) limpio[clave] = valor;
  }
  return Object.keys(limpio).length > 0 ? limpio : Prisma.DbNull;
}

router.get('/', async (req, res) => {
  const fincas = await prisma.finca.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { potreros: true } } },
  });
  res.json({ fincas });
});

router.get('/:id', async (req, res) => {
  const finca = await prisma.finca.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
    include: { _count: { select: { potreros: true } } },
  });
  if (!finca) return res.status(404).json({ error: 'Finca no encontrada' });
  res.json({ finca });
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const finca = await prisma.finca.create({
    data: {
      userId: req.user!.userId,
      nombre: parsed.data.nombre,
      capacidad: parsed.data.capacidad,
      propiedades: normalizePropiedades(parsed.data.propiedades),
    },
  });
  res.status(201).json({ finca });
});

router.put('/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.finca.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });
  if (!existing) return res.status(404).json({ error: 'Finca no encontrada' });

  const d = parsed.data;
  const data: Record<string, unknown> = {};
  if (d.nombre !== undefined) data.nombre = d.nombre;
  if (d.propiedades !== undefined) data.propiedades = normalizePropiedades(d.propiedades);

  const finca = await prisma.finca.update({
    where: { id: req.params.id },
    data,
  });
  res.json({ finca });
});

router.delete('/:id', async (req, res) => {
  const existing = await prisma.finca.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });
  if (!existing) return res.status(404).json({ error: 'Finca no encontrada' });
  await prisma.finca.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
