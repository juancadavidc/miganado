import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { withUrl } from '../lib/foto.js';
import {
  lotesVisiblesWhere, usuarioPublicSelect, rolesEnFinca, rolesEnFincaDeLote, esDueno,
} from '../lib/fincaAccess.js';

const router = Router();
router.use(requireAuth);

const sexoEnum = z.enum(['VP', 'HV', 'HL', 'ML', 'MC', 'TO']);

const loteSchema = z.object({
  fincaId: z.string().min(1, 'La finca es obligatoria'),
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

// El cuidador maneja el día a día (pesos, animales, gastos, anotaciones) pero no
// los valores comerciales ni los papeles de la feria: eso es solo del dueño.
const CAMPOS_COMERCIALES = [
  'numeroFeria', 'loteNumero', 'valorFinal', 'valorTotal',
  'deduccion', 'referencia', 'valorAPagar',
] as const;

const fincaInclude = {
  finca: {
    select: {
      id: true,
      nombre: true,
      dueno: { select: usuarioPublicSelect },
      cuidador: { select: usuarioPublicSelect },
    },
  },
} as const;

router.get('/', async (req, res) => {
  const lotes = await prisma.lote.findMany({
    where: lotesVisiblesWhere(req.user!.userId),
    orderBy: { fecha: 'desc' },
    include: {
      ...fincaInclude,
      ventas: { select: { cantidad: true } },
      _count: { select: { animales: true, fotos: true, gastos: true } },
    },
  });
  // En el listado solo interesa cuántas cabezas ya salieron, no el detalle de
  // cada venta: `cantidad` sigue siendo lo comprado y la resta son las que quedan.
  res.json({
    lotes: lotes.map(({ ventas, ...lote }) => ({
      ...lote,
      cantidadVendida: ventas.reduce((s, v) => s + v.cantidad, 0),
    })),
  });
});

router.get('/:id', async (req, res) => {
  const lote = await prisma.lote.findFirst({
    where: { id: req.params.id, ...lotesVisiblesWhere(req.user!.userId) },
    include: {
      ...fincaInclude,
      animales: {
        orderBy: { createdAt: 'asc' },
        include: {
          fotos: true,
          anotaciones: { orderBy: { createdAt: 'desc' } },
          prenez: { orderBy: { fechaDiagnostico: 'desc' } },
        },
      },
      gastos: {
        orderBy: { fecha: 'desc' },
        include: { anotaciones: { orderBy: { createdAt: 'desc' } } },
      },
      pesajes: { orderBy: { fecha: 'asc' } },
      ventas: { orderBy: { fecha: 'desc' } },
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
  // El lote debe ir a una finca que el usuario posea o cuide.
  if (!(await rolesEnFinca(req.user!.userId, data.fincaId))) {
    return res.status(404).json({ error: 'Finca no encontrada' });
  }

  const lote = await prisma.lote.create({
    data: {
      fincaId: data.fincaId,
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

  const finca = await rolesEnFincaDeLote(req.user!.userId, req.params.id);
  if (!finca) return res.status(404).json({ error: 'Lote no encontrado' });

  const d = parsed.data;
  if (!esDueno(finca, req.user!.userId)) {
    const tocaComercial = CAMPOS_COMERCIALES.some((c) => d[c] !== undefined);
    if (tocaComercial) {
      return res.status(403).json({
        error: 'Solo el dueño puede cambiar los valores comerciales del lote',
      });
    }
  }

  // El lote no se mueve de finca por acá (eso cambiaría su dueño/cuidador).
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
  const finca = await rolesEnFincaDeLote(req.user!.userId, req.params.id);
  if (!finca) return res.status(404).json({ error: 'Lote no encontrado' });
  if (!esDueno(finca, req.user!.userId)) {
    return res.status(403).json({ error: 'Solo el dueño puede eliminar el lote' });
  }
  await prisma.lote.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
