import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Ancho del lienzo del mapa en celdas. Las filas crecen libremente (scroll).
export const GRID_COLS = 16;

type Rect = { x: number; y: number; w: number; h: number };

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

const createSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  notas: z.string().optional().nullable(),
});

const updateSchema = z.object({
  nombre: z.string().trim().min(1).optional(),
  notas: z.string().optional().nullable(),
  ocupado: z.boolean().optional(),
  gridX: z.coerce.number().int().min(0).nullable().optional(),
  gridY: z.coerce.number().int().min(0).nullable().optional(),
  gridW: z.coerce.number().int().min(1).max(GRID_COLS).optional(),
  gridH: z.coerce.number().int().min(1).optional(),
});

router.get('/', async (req, res) => {
  const potreros = await prisma.potrero.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ potreros });
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const potrero = await prisma.potrero.create({
    data: {
      userId: req.user!.userId,
      nombre: parsed.data.nombre,
      notas: parsed.data.notas ?? null,
      ocupado: false,
      vacioDesde: new Date(),
    },
  });
  res.status(201).json({ potrero });
});

router.put('/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.potrero.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });
  if (!existing) return res.status(404).json({ error: 'Potrero no encontrado' });

  const d = parsed.data;
  const data: Record<string, unknown> = {};
  if (d.nombre !== undefined) data.nombre = d.nombre;
  if (d.notas !== undefined) data.notas = d.notas;
  // Al cambiar el estado, marcamos la fecha del cambio: arranca el contador de
  // ocupación o el de descanso (tiempo sin ganado para recuperar el pasto).
  if (d.ocupado !== undefined && d.ocupado !== existing.ocupado) {
    const now = new Date();
    data.ocupado = d.ocupado;
    if (d.ocupado) {
      data.ocupadoDesde = now;
      data.vacioDesde = null;
    } else {
      data.vacioDesde = now;
      data.ocupadoDesde = null;
    }
  }

  const touchesGrid =
    d.gridX !== undefined || d.gridY !== undefined || d.gridW !== undefined || d.gridH !== undefined;
  if (touchesGrid) {
    if (d.gridX !== undefined) data.gridX = d.gridX;
    if (d.gridY !== undefined) data.gridY = d.gridY;
    if (d.gridW !== undefined) data.gridW = d.gridW;
    if (d.gridH !== undefined) data.gridH = d.gridH;

    const x = d.gridX !== undefined ? d.gridX : existing.gridX;
    const y = d.gridY !== undefined ? d.gridY : existing.gridY;
    const w = d.gridW !== undefined ? d.gridW : existing.gridW;
    const h = d.gridH !== undefined ? d.gridH : existing.gridH;

    // Solo validamos ubicación cuando el potrero queda colocado (x e y no nulos).
    if (x !== null && y !== null) {
      if (x + w > GRID_COLS) {
        return res.status(400).json({ error: `El potrero se sale del mapa (máx ${GRID_COLS} columnas)` });
      }
      const otros = await prisma.potrero.findMany({
        where: {
          userId: req.user!.userId,
          id: { not: req.params.id },
          gridX: { not: null },
          gridY: { not: null },
        },
        select: { gridX: true, gridY: true, gridW: true, gridH: true },
      });
      const candidato: Rect = { x, y, w, h };
      const choca = otros.some((o) =>
        rectsOverlap(candidato, { x: o.gridX!, y: o.gridY!, w: o.gridW, h: o.gridH }),
      );
      if (choca) {
        return res.status(400).json({ error: 'El potrero se solapa con otro' });
      }
    }
  }

  const potrero = await prisma.potrero.update({
    where: { id: req.params.id },
    data,
  });
  res.json({ potrero });
});

router.delete('/:id', async (req, res) => {
  const existing = await prisma.potrero.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });
  if (!existing) return res.status(404).json({ error: 'Potrero no encontrado' });
  await prisma.potrero.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
