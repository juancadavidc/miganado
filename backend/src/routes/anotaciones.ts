import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const anotacionSchema = z
  .object({
    loteId: z.string().min(1).optional(),
    animalId: z.string().min(1).optional(),
    gastoId: z.string().min(1).optional(),
    texto: z.string().min(1).max(2000),
  })
  .refine(
    (d) => [d.loteId, d.animalId, d.gastoId].filter(Boolean).length === 1,
    { message: 'Indicá exactamente uno: loteId, animalId o gastoId' },
  );

async function userOwnsTarget(
  userId: string,
  target: { loteId?: string; animalId?: string; gastoId?: string },
): Promise<boolean> {
  if (target.loteId) {
    const lote = await prisma.lote.findFirst({ where: { id: target.loteId, userId } });
    return !!lote;
  }
  if (target.animalId) {
    const animal = await prisma.animal.findUnique({
      where: { id: target.animalId },
      include: { lote: true },
    });
    return !!animal && animal.lote.userId === userId;
  }
  if (target.gastoId) {
    const gasto = await prisma.gasto.findUnique({
      where: { id: target.gastoId },
      include: { lote: true },
    });
    return !!gasto && gasto.lote.userId === userId;
  }
  return false;
}

router.post('/', async (req, res) => {
  const parsed = anotacionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { loteId, animalId, gastoId, texto } = parsed.data;
  if (!(await userOwnsTarget(req.user!.userId, { loteId, animalId, gastoId }))) {
    return res.status(404).json({ error: 'Recurso no encontrado' });
  }

  const anotacion = await prisma.anotacion.create({
    data: {
      loteId: loteId ?? null,
      animalId: animalId ?? null,
      gastoId: gastoId ?? null,
      texto,
    },
  });
  res.status(201).json({ anotacion });
});

const updateSchema = z.object({ texto: z.string().min(1).max(2000) });

router.put('/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.anotacion.findUnique({
    where: { id: req.params.id },
    include: {
      lote: true,
      animal: { include: { lote: true } },
      gasto: { include: { lote: true } },
    },
  });
  if (!existing) return res.status(404).json({ error: 'Anotación no encontrada' });

  const ownerId =
    existing.lote?.userId ?? existing.animal?.lote.userId ?? existing.gasto?.lote.userId;
  if (ownerId !== req.user!.userId) {
    return res.status(404).json({ error: 'Anotación no encontrada' });
  }

  const anotacion = await prisma.anotacion.update({
    where: { id: req.params.id },
    data: { texto: parsed.data.texto },
  });
  res.json({ anotacion });
});

router.delete('/:id', async (req, res) => {
  const existing = await prisma.anotacion.findUnique({
    where: { id: req.params.id },
    include: {
      lote: true,
      animal: { include: { lote: true } },
      gasto: { include: { lote: true } },
    },
  });
  if (!existing) return res.status(404).json({ error: 'Anotación no encontrada' });

  const ownerId =
    existing.lote?.userId ?? existing.animal?.lote.userId ?? existing.gasto?.lote.userId;
  if (ownerId !== req.user!.userId) {
    return res.status(404).json({ error: 'Anotación no encontrada' });
  }

  await prisma.anotacion.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
