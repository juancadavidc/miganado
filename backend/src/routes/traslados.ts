import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { usuarioPublicSelect } from '../lib/fincaAccess.js';

const router = Router();
router.use(requireAuth);

const fincaResumenSelect = {
  id: true,
  nombre: true,
  dueno: { select: usuarioPublicSelect },
  cuidador: { select: usuarioPublicSelect },
  _count: { select: { lotes: true, potreros: true } },
} as const;

// Traslados pendientes: los que recibí (debo aceptar/rechazar) y los que envié
// (puedo cancelar mientras siguen pendientes).
router.get('/', async (req, res) => {
  const me = req.user!.userId;
  const [recibidos, enviados] = await Promise.all([
    prisma.traslado.findMany({
      where: { paraUserId: me, estado: 'PENDIENTE' },
      orderBy: { createdAt: 'desc' },
      include: {
        finca: { select: fincaResumenSelect },
        creadoPor: { select: usuarioPublicSelect },
      },
    }),
    prisma.traslado.findMany({
      where: { creadoPorId: me, estado: 'PENDIENTE' },
      orderBy: { createdAt: 'desc' },
      include: {
        finca: { select: fincaResumenSelect },
        para: { select: usuarioPublicSelect },
      },
    }),
  ]);
  res.json({ recibidos, enviados });
});

// El destinatario acepta: recién acá la finca cambia de dueño/cuidador.
router.post('/:id/aceptar', async (req, res) => {
  const me = req.user!.userId;
  const traslado = await prisma.traslado.findFirst({
    where: { id: req.params.id, paraUserId: me, estado: 'PENDIENTE' },
  });
  if (!traslado) return res.status(404).json({ error: 'Traslado no encontrado' });

  await prisma.$transaction(async (tx) => {
    await tx.traslado.update({
      where: { id: traslado.id },
      data: { estado: 'ACEPTADO', respondidoAt: new Date() },
    });
    if (traslado.rol === 'CUIDADOR') {
      await tx.finca.update({ where: { id: traslado.fincaId }, data: { cuidadorId: me } });
    } else {
      await tx.finca.update({ where: { id: traslado.fincaId }, data: { duenoId: me } });
    }
  });
  res.json({ ok: true });
});

router.post('/:id/rechazar', async (req, res) => {
  const me = req.user!.userId;
  const traslado = await prisma.traslado.findFirst({
    where: { id: req.params.id, paraUserId: me, estado: 'PENDIENTE' },
  });
  if (!traslado) return res.status(404).json({ error: 'Traslado no encontrado' });

  await prisma.traslado.update({
    where: { id: traslado.id },
    data: { estado: 'RECHAZADO', respondidoAt: new Date() },
  });
  res.json({ ok: true });
});

// Quien lo creó (el dueño) puede cancelar mientras siga pendiente.
router.post('/:id/cancelar', async (req, res) => {
  const me = req.user!.userId;
  const traslado = await prisma.traslado.findFirst({
    where: { id: req.params.id, creadoPorId: me, estado: 'PENDIENTE' },
  });
  if (!traslado) return res.status(404).json({ error: 'Traslado no encontrado' });

  await prisma.traslado.update({
    where: { id: traslado.id },
    data: { estado: 'CANCELADO', respondidoAt: new Date() },
  });
  res.json({ ok: true });
});

export default router;
