import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { puedeOperar, rolesEnFincaDeLote } from '../lib/fincaAccess.js';

const router = Router();
router.use(requireAuth);

// Registro rápido del pesaje del grupo: fecha + cabezas + peso total. El promedio
// y la GMD los calcula el frontend a partir de estos datos y del peso de compra.
const pesajeSchema = z.object({
  loteId: z.string().min(1),
  fecha: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  cantidad: z.coerce.number().int().min(1),
  pesoTotal: z.coerce.number().positive('El peso total debe ser mayor a 0'),
  notas: z.string().optional().nullable(),
});

router.post('/', async (req, res) => {
  const parsed = pesajeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { loteId, fecha, cantidad, pesoTotal, notas } = parsed.data;
  // Pesar es trabajo operativo del día a día: dueño o cuidador.
  if (!(await rolesEnFincaDeLote(req.user!.userId, loteId))) {
    return res.status(404).json({ error: 'Lote no encontrado' });
  }

  const pesaje = await prisma.pesaje.create({
    data: { loteId, fecha: new Date(fecha), cantidad, pesoTotal, notas: notas ?? null },
  });
  res.status(201).json({ pesaje });
});

router.delete('/:id', async (req, res) => {
  const existing = await prisma.pesaje.findUnique({
    where: { id: req.params.id },
    include: { lote: { select: { finca: { select: { duenoId: true, cuidadorId: true } } } } },
  });
  if (!existing || !puedeOperar(existing.lote.finca, req.user!.userId)) {
    return res.status(404).json({ error: 'Pesaje no encontrado' });
  }
  await prisma.pesaje.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
