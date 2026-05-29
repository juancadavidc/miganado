import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { puedeOperar } from '../lib/fincaAccess.js';

const router = Router();
router.use(requireAuth);

const estadoEnum = z.enum(['PRENADA', 'PARIO', 'ABORTO']);
const fecha = z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

const prenezSchema = z.object({
  animalId: z.string().min(1),
  estado: estadoEnum.default('PRENADA'),
  fechaDiagnostico: fecha,
  fechaParto: fecha.optional().nullable(),
  criasMacho: z.coerce.number().int().min(0).default(0),
  criasHembra: z.coerce.number().int().min(0).default(0),
  notas: z.string().optional().nullable(),
});

// El animal vive en un lote → finca: ambos roles (dueño y cuidador) pueden operar
// los eventos reproductivos, igual que pesajes o anotaciones.
async function animalOperable(userId: string, animalId: string): Promise<boolean> {
  const animal = await prisma.animal.findUnique({
    where: { id: animalId },
    include: { lote: { select: { finca: { select: { duenoId: true, cuidadorId: true } } } } },
  });
  return !!animal && puedeOperar(animal.lote.finca, userId);
}

// Solo una vaca parida lleva control de preñez.
async function esVaca(animalId: string): Promise<boolean> {
  const animal = await prisma.animal.findUnique({ where: { id: animalId }, select: { sexo: true } });
  return animal?.sexo === 'VP';
}

router.post('/', async (req, res) => {
  const parsed = prenezSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { animalId, ...rest } = parsed.data;
  if (!(await animalOperable(req.user!.userId, animalId))) {
    return res.status(404).json({ error: 'Animal no encontrado' });
  }
  if (!(await esVaca(animalId))) {
    return res.status(400).json({ error: 'Solo una vaca parida (VP) lleva control de preñez' });
  }

  const parida = rest.estado === 'PARIO';
  const prenez = await prisma.prenez.create({
    data: {
      animalId,
      estado: rest.estado,
      fechaDiagnostico: new Date(rest.fechaDiagnostico),
      fechaParto: parida && rest.fechaParto ? new Date(rest.fechaParto) : null,
      criasMacho: parida ? rest.criasMacho : 0,
      criasHembra: parida ? rest.criasHembra : 0,
      notas: rest.notas ?? null,
    },
  });
  res.status(201).json({ prenez });
});

router.put('/:id', async (req, res) => {
  const parsed = prenezSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.prenez.findUnique({
    where: { id: req.params.id },
    include: { animal: { include: { lote: { select: { finca: { select: { duenoId: true, cuidadorId: true } } } } } } },
  });
  if (!existing || !puedeOperar(existing.animal.lote.finca, req.user!.userId)) {
    return res.status(404).json({ error: 'Evento no encontrado' });
  }

  const d = parsed.data;
  // El estado que va a quedar tras la edición decide si el parto/crías tienen sentido.
  const estadoFinal = d.estado ?? existing.estado;
  const parida = estadoFinal === 'PARIO';
  const prenez = await prisma.prenez.update({
    where: { id: req.params.id },
    data: {
      ...(d.estado !== undefined && { estado: d.estado }),
      ...(d.fechaDiagnostico !== undefined && { fechaDiagnostico: new Date(d.fechaDiagnostico) }),
      // Si deja de estar parida, limpiamos parto y crías para no dejar datos colgados.
      ...(parida
        ? {
            ...(d.fechaParto !== undefined && { fechaParto: d.fechaParto ? new Date(d.fechaParto) : null }),
            ...(d.criasMacho !== undefined && { criasMacho: d.criasMacho }),
            ...(d.criasHembra !== undefined && { criasHembra: d.criasHembra }),
          }
        : { fechaParto: null, criasMacho: 0, criasHembra: 0 }),
      ...(d.notas !== undefined && { notas: d.notas }),
    },
  });
  res.json({ prenez });
});

router.delete('/:id', async (req, res) => {
  const existing = await prisma.prenez.findUnique({
    where: { id: req.params.id },
    include: { animal: { include: { lote: { select: { finca: { select: { duenoId: true, cuidadorId: true } } } } } } },
  });
  if (!existing || !puedeOperar(existing.animal.lote.finca, req.user!.userId)) {
    return res.status(404).json({ error: 'Evento no encontrado' });
  }
  await prisma.prenez.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
