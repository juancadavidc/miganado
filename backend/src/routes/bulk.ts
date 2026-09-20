import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { puedeOperar, lotesVisiblesWhere } from '../lib/fincaAccess.js';

// Operaciones masivas sobre varios lotes a la vez. Pensado para crecer: hoy solo
// reparte el flete de un viaje, mañana podrían sumarse otras acciones bulk.
const router = Router();
router.use(requireAuth);

// Gasto de transporte prorrateado: un viaje sube varios lotes al camión y su
// costo total pertenece al viaje, no a un lote. Se reparte por cabeza (partes
// iguales) y se crea un Gasto por lote con la parte que le toca, para que al
// vender cada animal cargue su flete.
const transporteSchema = z.object({
  loteIds: z.array(z.string().min(1)).min(1),
  montoTotal: z.coerce.number().positive(),
  fecha: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  descripcion: z.string().min(1).max(255).optional(),
});

router.post('/gastos-transporte', async (req, res) => {
  const parsed = transporteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { montoTotal, fecha, descripcion } = parsed.data;
  const loteIds = [...new Set(parsed.data.loteIds)];

  const lotes = await prisma.lote.findMany({
    where: { id: { in: loteIds }, ...lotesVisiblesWhere(req.user!.userId) },
    select: { id: true, cantidad: true, finca: { select: { duenoId: true, cuidadorId: true } } },
  });

  // Todos los lotes pedidos deben existir y ser operables por el usuario.
  if (lotes.length !== loteIds.length || !lotes.every((l) => puedeOperar(l.finca, req.user!.userId))) {
    return res.status(404).json({ error: 'Uno o más lotes no existen o no son tuyos' });
  }

  const totalCabezas = lotes.reduce((sum, l) => sum + l.cantidad, 0);
  if (totalCabezas <= 0) {
    return res.status(400).json({ error: 'Los lotes seleccionados no tienen cabezas' });
  }

  // Reparto exacto en centavos (método del mayor resto): la suma de las partes
  // es siempre el monto total, sin perder ni inventar plata por redondeos.
  const totalCent = Math.round(montoTotal * 100);
  const repartos = lotes.map((l) => {
    const exacto = (totalCent * l.cantidad) / totalCabezas;
    const base = Math.floor(exacto);
    return { lote: l, cent: base, resto: exacto - base };
  });
  const sobrante = totalCent - repartos.reduce((s, r) => s + r.cent, 0);
  repartos.sort((a, b) => b.resto - a.resto);
  for (let i = 0; i < sobrante; i++) repartos[i].cent += 1;

  const fechaViaje = fecha ? new Date(fecha) : new Date();
  const desc = descripcion?.trim() || 'Transporte';

  const gastos = await prisma.$transaction(
    repartos.map((r) =>
      prisma.gasto.create({
        data: { loteId: r.lote.id, tipo: 'TRANSPORTE', descripcion: desc, monto: r.cent / 100, fecha: fechaViaje },
      }),
    ),
  );

  res.status(201).json({ gastos, totalCabezas, costoPorCabeza: totalCent / totalCabezas / 100 });
});

export default router;
