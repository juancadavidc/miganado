import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const sexoEnum = z.enum(['VP', 'HV', 'HL', 'ML', 'MC']);

const animalSchema = z.object({
  loteId: z.string().min(1),
  identificador: z.string().optional().nullable(),
  sexo: sexoEnum,
  peso: z.coerce.number().min(0).optional().nullable(),
  notas: z.string().optional().nullable(),
});

async function userOwnsLote(userId: string, loteId: string): Promise<boolean> {
  const lote = await prisma.lote.findFirst({ where: { id: loteId, userId } });
  return !!lote;
}

router.post('/', async (req, res) => {
  const parsed = animalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { loteId, ...rest } = parsed.data;
  if (!(await userOwnsLote(req.user!.userId, loteId))) {
    return res.status(404).json({ error: 'Lote no encontrado' });
  }

  const animal = await prisma.animal.create({
    data: {
      loteId,
      identificador: rest.identificador ?? null,
      sexo: rest.sexo,
      peso: rest.peso ?? null,
      notas: rest.notas ?? null,
    },
  });
  res.status(201).json({ animal });
});

router.put('/:id', async (req, res) => {
  const parsed = animalSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.animal.findUnique({
    where: { id: req.params.id },
    include: { lote: true },
  });
  if (!existing || existing.lote.userId !== req.user!.userId) {
    return res.status(404).json({ error: 'Animal no encontrado' });
  }

  const d = parsed.data;
  const animal = await prisma.animal.update({
    where: { id: req.params.id },
    data: {
      ...(d.identificador !== undefined && { identificador: d.identificador }),
      ...(d.sexo !== undefined && { sexo: d.sexo }),
      ...(d.peso !== undefined && { peso: d.peso }),
      ...(d.notas !== undefined && { notas: d.notas }),
    },
  });
  res.json({ animal });
});

router.delete('/:id', async (req, res) => {
  const existing = await prisma.animal.findUnique({
    where: { id: req.params.id },
    include: { lote: true },
  });
  if (!existing || existing.lote.userId !== req.user!.userId) {
    return res.status(404).json({ error: 'Animal no encontrado' });
  }
  await prisma.animal.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
