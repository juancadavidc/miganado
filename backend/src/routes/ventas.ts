import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { esDueno, rolesEnFincaDeLote } from '../lib/fincaAccess.js';

const router = Router();
router.use(requireAuth);

// Salida del lote: se vende el lote completo o una parte (lo normal es sacar los
// más gordos y dejar el resto cebándose). El peso de salida es opcional porque
// en feria a veces se vende por cabeza sin báscula.
const ventaSchema = z.object({
  loteId: z.string().min(1),
  animalId: z.string().min(1).optional().nullable(),
  fecha: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  cantidad: z.coerce.number().int().min(1).default(1),
  pesoTotal: z.coerce.number().positive().optional().nullable(),
  valorTotal: z.coerce.number().min(0).default(0),
  deduccion: z.coerce.number().min(0).default(0),
  valorRecibido: z.coerce.number().min(0).default(0),
  comprador: z.string().optional().nullable(),
  notas: z.string().optional().nullable(),
});

// Cabezas que todavía están en la finca: compradas menos todas las salidas.
async function cabezasDisponibles(loteId: string): Promise<number> {
  const lote = await prisma.lote.findUnique({ where: { id: loteId }, select: { cantidad: true } });
  if (!lote) return 0;
  const vendidas = await prisma.venta.aggregate({ where: { loteId }, _sum: { cantidad: true } });
  return lote.cantidad - (vendidas._sum.cantidad ?? 0);
}

router.post('/', async (req, res) => {
  const parsed = ventaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const d = parsed.data;
  // Vender es plata: como los demas valores comerciales, solo la registra el dueño.
  const finca = await rolesEnFincaDeLote(req.user!.userId, d.loteId);
  if (!finca) return res.status(404).json({ error: 'Lote no encontrado' });
  if (!esDueno(finca, req.user!.userId)) {
    return res.status(403).json({ error: 'Solo el dueño puede registrar ventas' });
  }

  // Vender un animal registrado individualmente es siempre una cabeza, la suya.
  let cantidad = d.cantidad;
  if (d.animalId) {
    const animal = await prisma.animal.findUnique({
      where: { id: d.animalId },
      select: { loteId: true, venta: { select: { id: true } } },
    });
    if (!animal || animal.loteId !== d.loteId) {
      return res.status(404).json({ error: 'Animal no encontrado en este lote' });
    }
    if (animal.venta) return res.status(409).json({ error: 'Ese animal ya está vendido' });
    cantidad = 1;
  }

  const disponibles = await cabezasDisponibles(d.loteId);
  if (disponibles <= 0) {
    return res.status(409).json({ error: 'El lote ya está vendido completo' });
  }
  if (cantidad > disponibles) {
    return res.status(409).json({
      error: `Solo quedan ${disponibles} ${disponibles === 1 ? 'cabeza' : 'cabezas'} sin vender en el lote`,
    });
  }

  const venta = await prisma.venta.create({
    data: {
      loteId: d.loteId,
      animalId: d.animalId ?? null,
      fecha: new Date(d.fecha),
      cantidad,
      pesoTotal: d.pesoTotal ?? null,
      valorTotal: d.valorTotal,
      deduccion: d.deduccion,
      valorRecibido: d.valorRecibido,
      comprador: d.comprador ?? null,
      notas: d.notas ?? null,
    },
  });
  res.status(201).json({ venta });
});

router.delete('/:id', async (req, res) => {
  const existing = await prisma.venta.findUnique({
    where: { id: req.params.id },
    include: { lote: { select: { finca: { select: { duenoId: true, cuidadorId: true } } } } },
  });
  if (!existing) return res.status(404).json({ error: 'Venta no encontrada' });
  if (!esDueno(existing.lote.finca, req.user!.userId)) {
    return res.status(404).json({ error: 'Venta no encontrada' });
  }
  await prisma.venta.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
