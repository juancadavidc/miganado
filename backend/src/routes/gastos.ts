import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const gastoSchema = z.object({
  loteId: z.string().min(1),
  descripcion: z.string().min(1).max(255),
  monto: z.coerce.number().min(0),
  fecha: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
});

router.post('/', async (req, res) => {
  const parsed = gastoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { loteId, descripcion, monto, fecha } = parsed.data;
  const lote = await prisma.lote.findFirst({
    where: { id: loteId, userId: req.user!.userId },
  });
  if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });

  const gasto = await prisma.gasto.create({
    data: {
      loteId,
      descripcion,
      monto,
      fecha: fecha ? new Date(fecha) : new Date(),
    },
  });
  res.status(201).json({ gasto });
});

router.delete('/:id', async (req, res) => {
  const existing = await prisma.gasto.findUnique({
    where: { id: req.params.id },
    include: { lote: true },
  });
  if (!existing || existing.lote.userId !== req.user!.userId) {
    return res.status(404).json({ error: 'Gasto no encontrado' });
  }
  await prisma.gasto.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
