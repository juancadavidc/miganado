import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { fincasVisiblesWhere } from '../lib/fincaAccess.js';

// Vista "viva" de una finca: sus potreros y el ganado que hay hoy en cada uno.
// Solo cuenta lo que sigue en finca (compradas − vendidas) y, por lote, trae lo
// justo para la ficha que se abre al tocar un animal en el mapa.
const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const parsed = z.object({ fincaId: z.string().min(1) }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const finca = await prisma.finca.findFirst({
    where: { id: parsed.data.fincaId, ...fincasVisiblesWhere(req.user!.userId) },
    select: { id: true, nombre: true, capacidad: true },
  });
  if (!finca) return res.status(404).json({ error: 'Finca no encontrada' });

  const [potreros, lotes] = await Promise.all([
    prisma.potrero.findMany({ where: { fincaId: finca.id }, orderBy: { createdAt: 'asc' } }),
    prisma.lote.findMany({
      where: { fincaId: finca.id },
      orderBy: { fecha: 'asc' },
      include: {
        ventas: { select: { cantidad: true } },
        pesajes: { orderBy: { fecha: 'desc' }, take: 1 },
        animales: {
          where: { venta: null, muerteFecha: null },
          select: {
            id: true, identificador: true, sexo: true, peso: true, notas: true, madreId: true,
            esCria: true, nacimiento: true, destetadoAt: true,
          },
        },
      },
    }),
  ]);

  const enFinca = lotes
    .map(({ ventas, pesajes, animales, ...l }) => {
      const cabezas = l.cantidad - ventas.reduce((s, v) => s + v.cantidad, 0);
      const ultimo = pesajes[0];
      const pesoActual = ultimo
        ? Number(ultimo.pesoTotal) / ultimo.cantidad
        : l.pesoPromedio != null
          ? Number(l.pesoPromedio)
          : l.cantidad > 0 && Number(l.pesoTotal) > 0
            ? Number(l.pesoTotal) / l.cantidad
            : null;
      return {
        id: l.id,
        potreroId: l.potreroId,
        potreroDesde: l.potreroDesde,
        fecha: l.fecha,
        loteNumero: l.loteNumero,
        numeroFeria: l.numeroFeria,
        sexo: l.sexo,
        cantidad: l.cantidad,
        cabezas,
        pesoCompra: l.cantidad > 0 && Number(l.pesoTotal) > 0 ? Number(l.pesoTotal) / l.cantidad : null,
        pesoActual,
        ultimoPesaje: ultimo?.fecha ?? null,
        animales,
      };
    })
    .filter((l) => l.cabezas > 0 || l.animales.length > 0);

  res.json({ finca, potreros, lotes: enFinca });
});

export default router;
