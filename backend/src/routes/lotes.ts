import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { withUrl } from '../lib/foto.js';
import { nombreGrupoDeLote } from '../lib/grupo.js';

const router = Router();
router.use(requireAuth);

const sexoEnum = z.enum(['VP', 'HV', 'HL', 'ML', 'MC', 'TO']);

const loteSchema = z.object({
  fecha: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  numeroFeria: z.string().optional().nullable(),
  loteNumero: z.string().optional().nullable(),
  sexo: sexoEnum,
  cantidad: z.coerce.number().int().min(1).default(1),
  pesoTotal: z.coerce.number().min(0).default(0),
  pesoPromedio: z.coerce.number().min(0).optional().nullable(),
  valorFinal: z.coerce.number().min(0).default(0),
  valorTotal: z.coerce.number().min(0).default(0),
  deduccion: z.coerce.number().min(0).default(0),
  referencia: z.string().optional().nullable(),
  valorAPagar: z.coerce.number().min(0).default(0),
  criasMacho: z.coerce.number().int().min(0).default(0),
  criasHembra: z.coerce.number().int().min(0).default(0),
  notas: z.string().optional().nullable(),
});

router.get('/', async (req, res) => {
  const lotes = await prisma.lote.findMany({
    where: { userId: req.user!.userId },
    orderBy: { fecha: 'desc' },
    include: {
      _count: { select: { animales: true, fotos: true, gastos: true } },
    },
  });
  res.json({ lotes });
});

router.get('/:id', async (req, res) => {
  const lote = await prisma.lote.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
    include: {
      animales: {
        orderBy: { createdAt: 'asc' },
        include: {
          fotos: true,
          anotaciones: { orderBy: { createdAt: 'desc' } },
        },
      },
      gastos: {
        orderBy: { fecha: 'desc' },
        include: { anotaciones: { orderBy: { createdAt: 'desc' } } },
      },
      fotos: { where: { animalId: null }, orderBy: { createdAt: 'desc' } },
      anotaciones: { orderBy: { createdAt: 'desc' } },
      grupos: {
        orderBy: { createdAt: 'asc' },
        include: {
          potrero: { select: { id: true, nombre: true, fincaId: true, finca: { select: { id: true, nombre: true } } } },
        },
      },
    },
  });
  if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });
  const loteConUrls = {
    ...lote,
    fotos: lote.fotos.map(withUrl),
    animales: lote.animales.map((a) => ({ ...a, fotos: a.fotos.map(withUrl) })),
  };
  res.json({ lote: loteConUrls });
});

router.post('/', async (req, res) => {
  const parsed = loteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const data = parsed.data;
  const userId = req.user!.userId;
  // Junto con el lote se crea su grupo de ganado (sin ubicar) para poder asignarlo
  // luego a un potrero, igual que en la importación por imagen.
  const lote = await prisma.$transaction(async (tx) => {
    const creado = await tx.lote.create({
      data: {
        userId,
        fecha: new Date(data.fecha),
        numeroFeria: data.numeroFeria ?? null,
        loteNumero: data.loteNumero ?? null,
        sexo: data.sexo,
        cantidad: data.cantidad,
        pesoTotal: data.pesoTotal,
        pesoPromedio: data.pesoPromedio ?? null,
        valorFinal: data.valorFinal,
        valorTotal: data.valorTotal,
        deduccion: data.deduccion,
        referencia: data.referencia ?? null,
        valorAPagar: data.valorAPagar,
        criasMacho: data.criasMacho,
        criasHembra: data.criasHembra,
        notas: data.notas ?? null,
      },
    });
    await tx.grupo.create({
      data: {
        userId,
        nombre: nombreGrupoDeLote(creado),
        sexo: creado.sexo,
        cantidad: creado.cantidad,
        loteId: creado.id,
      },
    });
    return creado;
  });
  res.status(201).json({ lote });
});

router.put('/:id', async (req, res) => {
  const parsed = loteSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.lote.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });
  if (!existing) return res.status(404).json({ error: 'Lote no encontrado' });

  const d = parsed.data;
  const lote = await prisma.lote.update({
    where: { id: req.params.id },
    data: {
      ...(d.fecha !== undefined && { fecha: new Date(d.fecha) }),
      ...(d.numeroFeria !== undefined && { numeroFeria: d.numeroFeria }),
      ...(d.loteNumero !== undefined && { loteNumero: d.loteNumero }),
      ...(d.sexo !== undefined && { sexo: d.sexo }),
      ...(d.cantidad !== undefined && { cantidad: d.cantidad }),
      ...(d.pesoTotal !== undefined && { pesoTotal: d.pesoTotal }),
      ...(d.pesoPromedio !== undefined && { pesoPromedio: d.pesoPromedio }),
      ...(d.valorFinal !== undefined && { valorFinal: d.valorFinal }),
      ...(d.valorTotal !== undefined && { valorTotal: d.valorTotal }),
      ...(d.deduccion !== undefined && { deduccion: d.deduccion }),
      ...(d.referencia !== undefined && { referencia: d.referencia }),
      ...(d.valorAPagar !== undefined && { valorAPagar: d.valorAPagar }),
      ...(d.criasMacho !== undefined && { criasMacho: d.criasMacho }),
      ...(d.criasHembra !== undefined && { criasHembra: d.criasHembra }),
      ...(d.notas !== undefined && { notas: d.notas }),
    },
  });
  res.json({ lote });
});

router.delete('/:id', async (req, res) => {
  const existing = await prisma.lote.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });
  if (!existing) return res.status(404).json({ error: 'Lote no encontrado' });
  await prisma.lote.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
