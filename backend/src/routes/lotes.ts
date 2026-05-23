import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { withUrl } from '../lib/foto.js';
import { lotesVisiblesWhere, usuarioPublicSelect } from '../lib/loteAccess.js';

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

// Campos comerciales: solo el dueño puede tocarlos. El cuidador maneja el día a
// día (pesos, animales, gastos, anotaciones) pero no la plata ni los papeles.
const CAMPOS_COMERCIALES = [
  'numeroFeria', 'loteNumero', 'valorFinal', 'valorTotal',
  'deduccion', 'referencia', 'valorAPagar',
] as const;

router.get('/', async (req, res) => {
  const lotes = await prisma.lote.findMany({
    where: lotesVisiblesWhere(req.user!.userId),
    orderBy: { fecha: 'desc' },
    include: {
      dueno: { select: usuarioPublicSelect },
      cuidador: { select: usuarioPublicSelect },
      _count: { select: { animales: true, fotos: true, gastos: true } },
    },
  });
  res.json({ lotes });
});

router.get('/:id', async (req, res) => {
  const lote = await prisma.lote.findFirst({
    where: { id: req.params.id, ...lotesVisiblesWhere(req.user!.userId) },
    include: {
      dueno: { select: usuarioPublicSelect },
      cuidador: { select: usuarioPublicSelect },
      traslados: {
        where: { estado: 'PENDIENTE' },
        orderBy: { createdAt: 'desc' },
        include: {
          para: { select: usuarioPublicSelect },
          creadoPor: { select: usuarioPublicSelect },
        },
      },
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
  // Al crear, el usuario es dueño y cuidador del lote (control total).
  const lote = await prisma.lote.create({
    data: {
      duenoId: req.user!.userId,
      cuidadorId: req.user!.userId,
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
  res.status(201).json({ lote });
});

router.put('/:id', async (req, res) => {
  const parsed = loteSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.lote.findFirst({
    where: { id: req.params.id, ...lotesVisiblesWhere(req.user!.userId) },
    select: { id: true, duenoId: true, cuidadorId: true },
  });
  if (!existing) return res.status(404).json({ error: 'Lote no encontrado' });

  const d = parsed.data;
  const esDueno = existing.duenoId === req.user!.userId;
  if (!esDueno) {
    const tocaComercial = CAMPOS_COMERCIALES.some((c) => d[c] !== undefined);
    if (tocaComercial) {
      return res.status(403).json({
        error: 'Solo el dueño puede cambiar los valores comerciales del lote',
      });
    }
  }

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
    where: { id: req.params.id, ...lotesVisiblesWhere(req.user!.userId) },
    select: { id: true, duenoId: true },
  });
  if (!existing) return res.status(404).json({ error: 'Lote no encontrado' });
  if (existing.duenoId !== req.user!.userId) {
    return res.status(403).json({ error: 'Solo el dueño puede eliminar el lote' });
  }
  await prisma.lote.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// --- Asignación de cuidador y transferencia de dueño ---

const asignarSchema = z.object({
  documento: z.string().min(1, 'Indicá el documento del usuario'),
  mensaje: z.string().max(500).optional().nullable(),
});

// Solo el dueño puede iniciar; devuelve el lote (select acotado) si es dueño.
async function loteDelDueno(loteId: string, userId: string) {
  return prisma.lote.findFirst({
    where: { id: loteId, duenoId: userId },
    select: { id: true, duenoId: true, cuidadorId: true },
  });
}

// El dueño asigna (o cambia) el cuidador. Si el destinatario es otro usuario, se
// crea un traslado PENDIENTE que el cuidador debe aceptar; el lote conserva su
// cuidador actual hasta entonces. Si el dueño se asigna a sí mismo, es inmediato.
router.post('/:id/cuidador', async (req, res) => {
  const parsed = asignarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const lote = await loteDelDueno(req.params.id, req.user!.userId);
  if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });

  const destino = await prisma.user.findUnique({
    where: { documento: parsed.data.documento.trim() },
    select: usuarioPublicSelect,
  });
  if (!destino) {
    return res.status(404).json({ error: 'No existe un usuario registrado con ese documento' });
  }
  if (destino.id === lote.cuidadorId) {
    return res.status(400).json({ error: 'Ese usuario ya es el cuidador del lote' });
  }

  // El dueño se asigna a sí mismo como cuidador: inmediato, ya tiene control.
  if (destino.id === req.user!.userId) {
    const actualizado = await prisma.$transaction(async (tx) => {
      await tx.traslado.updateMany({
        where: { loteId: lote.id, rol: 'CUIDADOR', estado: 'PENDIENTE' },
        data: { estado: 'CANCELADO', respondidoAt: new Date() },
      });
      return tx.lote.update({
        where: { id: lote.id },
        data: { cuidadorId: destino.id },
        include: { dueno: { select: usuarioPublicSelect }, cuidador: { select: usuarioPublicSelect } },
      });
    });
    return res.json({ lote: actualizado, traslado: null });
  }

  const traslado = await prisma.$transaction(async (tx) => {
    await tx.traslado.updateMany({
      where: { loteId: lote.id, rol: 'CUIDADOR', estado: 'PENDIENTE' },
      data: { estado: 'CANCELADO', respondidoAt: new Date() },
    });
    return tx.traslado.create({
      data: {
        loteId: lote.id,
        rol: 'CUIDADOR',
        paraUserId: destino.id,
        creadoPorId: req.user!.userId,
        mensaje: parsed.data.mensaje ?? null,
      },
      include: {
        para: { select: usuarioPublicSelect },
        creadoPor: { select: usuarioPublicSelect },
      },
    });
  });
  res.status(201).json({ traslado });
});

// El dueño quita el cuidador (y cancela cualquier traslado de cuidador pendiente).
router.delete('/:id/cuidador', async (req, res) => {
  const lote = await loteDelDueno(req.params.id, req.user!.userId);
  if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });

  const actualizado = await prisma.$transaction(async (tx) => {
    await tx.traslado.updateMany({
      where: { loteId: lote.id, rol: 'CUIDADOR', estado: 'PENDIENTE' },
      data: { estado: 'CANCELADO', respondidoAt: new Date() },
    });
    return tx.lote.update({
      where: { id: lote.id },
      data: { cuidadorId: null },
      include: { dueno: { select: usuarioPublicSelect }, cuidador: { select: usuarioPublicSelect } },
    });
  });
  res.json({ lote: actualizado });
});

// El dueño transfiere la propiedad. Siempre requiere que el nuevo dueño acepte.
router.post('/:id/dueno', async (req, res) => {
  const parsed = asignarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const lote = await loteDelDueno(req.params.id, req.user!.userId);
  if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });

  const destino = await prisma.user.findUnique({
    where: { documento: parsed.data.documento.trim() },
    select: usuarioPublicSelect,
  });
  if (!destino) {
    return res.status(404).json({ error: 'No existe un usuario registrado con ese documento' });
  }
  if (destino.id === req.user!.userId) {
    return res.status(400).json({ error: 'Ya sos el dueño del lote' });
  }

  const traslado = await prisma.$transaction(async (tx) => {
    await tx.traslado.updateMany({
      where: { loteId: lote.id, rol: 'DUENO', estado: 'PENDIENTE' },
      data: { estado: 'CANCELADO', respondidoAt: new Date() },
    });
    return tx.traslado.create({
      data: {
        loteId: lote.id,
        rol: 'DUENO',
        paraUserId: destino.id,
        creadoPorId: req.user!.userId,
        mensaje: parsed.data.mensaje ?? null,
      },
      include: {
        para: { select: usuarioPublicSelect },
        creadoPor: { select: usuarioPublicSelect },
      },
    });
  });
  res.status(201).json({ traslado });
});

export default router;
