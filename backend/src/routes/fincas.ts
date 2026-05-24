import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { fincasVisiblesWhere, usuarioPublicSelect, rolesEnFinca, esDueno } from '../lib/fincaAccess.js';

const router = Router();
router.use(requireAuth);

const propiedadesSchema = z.record(z.string(), z.string());

// La capacidad define el ancho del mapa en columnas y es fija al crear la finca.
const capacidadSchema = z.union([z.literal(16), z.literal(32), z.literal(64)]);

const createSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  capacidad: capacidadSchema,
  propiedades: propiedadesSchema.optional().nullable(),
});

const updateSchema = z.object({
  nombre: z.string().trim().min(1).optional(),
  propiedades: propiedadesSchema.optional().nullable(),
});

const asignarSchema = z.object({
  documento: z.string().min(1, 'Indicá el documento del usuario'),
  mensaje: z.string().max(500).optional().nullable(),
});

// Limpia el mapa de propiedades: descarta pares con clave o valor vacíos. Devuelve
// el objeto saneado, o Prisma.DbNull para guardar NULL cuando queda vacío (un campo
// Json? de Prisma no acepta `null` de JS directamente).
function normalizePropiedades(
  raw: Record<string, string> | null | undefined,
): Prisma.InputJsonObject | typeof Prisma.DbNull | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return Prisma.DbNull;
  const limpio: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const clave = k.trim();
    const valor = (v ?? '').trim();
    if (clave && valor) limpio[clave] = valor;
  }
  return Object.keys(limpio).length > 0 ? limpio : Prisma.DbNull;
}

const fincaInclude = {
  dueno: { select: usuarioPublicSelect },
  cuidador: { select: usuarioPublicSelect },
  _count: { select: { potreros: true, lotes: true } },
} as const;

router.get('/', async (req, res) => {
  const fincas = await prisma.finca.findMany({
    where: fincasVisiblesWhere(req.user!.userId),
    orderBy: { createdAt: 'asc' },
    include: fincaInclude,
  });
  res.json({ fincas });
});

router.get('/:id', async (req, res) => {
  const finca = await prisma.finca.findFirst({
    where: { id: req.params.id, ...fincasVisiblesWhere(req.user!.userId) },
    include: {
      ...fincaInclude,
      traslados: {
        where: { estado: 'PENDIENTE' },
        orderBy: { createdAt: 'desc' },
        include: {
          para: { select: usuarioPublicSelect },
          creadoPor: { select: usuarioPublicSelect },
        },
      },
    },
  });
  if (!finca) return res.status(404).json({ error: 'Finca no encontrada' });
  res.json({ finca });
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Al crear, el usuario es dueño y cuidador de la finca (control total).
  const finca = await prisma.finca.create({
    data: {
      duenoId: req.user!.userId,
      cuidadorId: req.user!.userId,
      nombre: parsed.data.nombre,
      capacidad: parsed.data.capacidad,
      propiedades: normalizePropiedades(parsed.data.propiedades),
    },
    include: fincaInclude,
  });
  res.status(201).json({ finca });
});

router.put('/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Dueño o cuidador pueden editar nombre/propiedades.
  if (!(await rolesEnFinca(req.user!.userId, req.params.id))) {
    return res.status(404).json({ error: 'Finca no encontrada' });
  }

  const d = parsed.data;
  const data: Record<string, unknown> = {};
  if (d.nombre !== undefined) data.nombre = d.nombre;
  if (d.propiedades !== undefined) data.propiedades = normalizePropiedades(d.propiedades);

  const finca = await prisma.finca.update({
    where: { id: req.params.id },
    data,
    include: fincaInclude,
  });
  res.json({ finca });
});

router.delete('/:id', async (req, res) => {
  const finca = await prisma.finca.findFirst({
    where: { id: req.params.id, ...fincasVisiblesWhere(req.user!.userId) },
    select: { id: true, duenoId: true },
  });
  if (!finca) return res.status(404).json({ error: 'Finca no encontrada' });
  if (finca.duenoId !== req.user!.userId) {
    return res.status(403).json({ error: 'Solo el dueño puede eliminar la finca' });
  }
  await prisma.finca.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// --- Asignación de cuidador y transferencia de dueño (a nivel de finca) ---

// Solo el dueño puede iniciar; devuelve los roles de la finca si lo es.
async function fincaDelDueno(fincaId: string, userId: string) {
  return prisma.finca.findFirst({
    where: { id: fincaId, duenoId: userId },
    select: { id: true, duenoId: true, cuidadorId: true },
  });
}

// El dueño asigna (o cambia) el cuidador de la finca. Si es otro usuario, se crea
// un traslado PENDIENTE que el cuidador debe aceptar; la finca conserva su cuidador
// actual hasta entonces. Si el dueño se asigna a sí mismo, es inmediato.
router.post('/:id/cuidador', async (req, res) => {
  const parsed = asignarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const finca = await fincaDelDueno(req.params.id, req.user!.userId);
  if (!finca) return res.status(404).json({ error: 'Finca no encontrada' });

  const destino = await prisma.user.findUnique({
    where: { documento: parsed.data.documento.trim() },
    select: usuarioPublicSelect,
  });
  if (!destino) {
    return res.status(404).json({ error: 'No existe un usuario registrado con ese documento' });
  }
  if (destino.id === finca.cuidadorId) {
    return res.status(400).json({ error: 'Ese usuario ya es el cuidador de la finca' });
  }

  if (destino.id === req.user!.userId) {
    const actualizada = await prisma.$transaction(async (tx) => {
      await tx.traslado.updateMany({
        where: { fincaId: finca.id, rol: 'CUIDADOR', estado: 'PENDIENTE' },
        data: { estado: 'CANCELADO', respondidoAt: new Date() },
      });
      return tx.finca.update({
        where: { id: finca.id },
        data: { cuidadorId: destino.id },
        include: fincaInclude,
      });
    });
    return res.json({ finca: actualizada, traslado: null });
  }

  const traslado = await prisma.$transaction(async (tx) => {
    await tx.traslado.updateMany({
      where: { fincaId: finca.id, rol: 'CUIDADOR', estado: 'PENDIENTE' },
      data: { estado: 'CANCELADO', respondidoAt: new Date() },
    });
    return tx.traslado.create({
      data: {
        fincaId: finca.id,
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
  const finca = await fincaDelDueno(req.params.id, req.user!.userId);
  if (!finca) return res.status(404).json({ error: 'Finca no encontrada' });

  const actualizada = await prisma.$transaction(async (tx) => {
    await tx.traslado.updateMany({
      where: { fincaId: finca.id, rol: 'CUIDADOR', estado: 'PENDIENTE' },
      data: { estado: 'CANCELADO', respondidoAt: new Date() },
    });
    return tx.finca.update({
      where: { id: finca.id },
      data: { cuidadorId: null },
      include: fincaInclude,
    });
  });
  res.json({ finca: actualizada });
});

// El dueño transfiere la propiedad. Siempre requiere que el nuevo dueño acepte.
router.post('/:id/dueno', async (req, res) => {
  const parsed = asignarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const finca = await fincaDelDueno(req.params.id, req.user!.userId);
  if (!finca) return res.status(404).json({ error: 'Finca no encontrada' });

  const destino = await prisma.user.findUnique({
    where: { documento: parsed.data.documento.trim() },
    select: usuarioPublicSelect,
  });
  if (!destino) {
    return res.status(404).json({ error: 'No existe un usuario registrado con ese documento' });
  }
  if (destino.id === req.user!.userId) {
    return res.status(400).json({ error: 'Ya sos el dueño de la finca' });
  }

  const traslado = await prisma.$transaction(async (tx) => {
    await tx.traslado.updateMany({
      where: { fincaId: finca.id, rol: 'DUENO', estado: 'PENDIENTE' },
      data: { estado: 'CANCELADO', respondidoAt: new Date() },
    });
    return tx.traslado.create({
      data: {
        fincaId: finca.id,
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
