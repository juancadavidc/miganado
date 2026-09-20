import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { esDueno, puedeOperar, rolesEnFincaDeLote } from '../lib/fincaAccess.js';

const router = Router();
router.use(requireAuth);

const tipoGastoEnum = z.enum([
  'TRANSPORTE', 'COMISION_CUIDADOR', 'VACUNAS', 'DESPARASITANTE', 'MEDICAMENTOS',
  'ALIMENTACION', 'ARRIENDO_PASTO', 'JORNALES', 'DOCUMENTOS', 'OTRO',
]);

// `descripcion` es solo el detalle; el tipo es lo que se filtra y suma. En OTRO el
// detalle es lo único que dice de qué fue el gasto, así que ahí sí es obligatorio.
const gastoSchema = z
  .object({
    loteId: z.string().min(1),
    tipo: tipoGastoEnum,
    descripcion: z.string().trim().max(255).default(''),
    monto: z.coerce.number().min(0),
    pagado: z.boolean().default(true),
    fecha: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  })
  .refine((g) => g.tipo !== 'OTRO' || g.descripcion.length > 0, {
    path: ['descripcion'],
    message: 'Cuéntanos de qué fue el gasto',
  });

router.post('/', async (req, res) => {
  const parsed = gastoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { loteId, tipo, descripcion, monto, pagado, fecha } = parsed.data;
  if (!(await rolesEnFincaDeLote(req.user!.userId, loteId))) {
    return res.status(404).json({ error: 'Lote no encontrado' });
  }

  const gasto = await prisma.gasto.create({
    data: {
      loteId,
      tipo,
      descripcion,
      monto,
      pagado,
      fecha: fecha ? new Date(fecha) : new Date(),
    },
  });
  res.status(201).json({ gasto });
});

// Saldar (o volver a dejar pendiente) un gasto. Es plata que sale del dueño, así que
// solo él lo marca, igual que las ventas; el cuidador ve el estado pero no lo cambia.
router.patch('/:id', async (req, res) => {
  const parsed = z.object({ pagado: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.gasto.findUnique({
    where: { id: req.params.id },
    include: { lote: { select: { finca: { select: { duenoId: true, cuidadorId: true } } } } },
  });
  if (!existing || !puedeOperar(existing.lote.finca, req.user!.userId)) {
    return res.status(404).json({ error: 'Gasto no encontrado' });
  }
  if (!esDueno(existing.lote.finca, req.user!.userId)) {
    return res.status(403).json({ error: 'Solo el dueño puede marcar un gasto como pagado' });
  }
  const gasto = await prisma.gasto.update({ where: { id: existing.id }, data: { pagado: parsed.data.pagado } });
  res.json({ gasto });
});

router.delete('/:id', async (req, res) => {
  const existing = await prisma.gasto.findUnique({
    where: { id: req.params.id },
    include: { lote: { select: { finca: { select: { duenoId: true, cuidadorId: true } } } } },
  });
  if (!existing || !puedeOperar(existing.lote.finca, req.user!.userId)) {
    return res.status(404).json({ error: 'Gasto no encontrado' });
  }
  await prisma.gasto.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
