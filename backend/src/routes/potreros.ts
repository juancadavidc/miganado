import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// El ancho del mapa lo define la capacidad de cada finca (16 | 32 | 64). Las filas
// crecen libremente (scroll). Este tope solo sirve de cota superior para validar la
// entrada; el límite real se contrasta contra la capacidad de la finca del potrero.
const MAX_CAPACIDAD = 64;

type Rect = { x: number; y: number; w: number; h: number };

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

const metadatosSchema = z.record(z.string(), z.string());

const createSchema = z.object({
  fincaId: z.string().min(1, 'La finca es obligatoria'),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  notas: z.string().optional().nullable(),
  metadatos: metadatosSchema.optional().nullable(),
});

const updateSchema = z.object({
  nombre: z.string().trim().min(1).optional(),
  notas: z.string().optional().nullable(),
  metadatos: metadatosSchema.optional().nullable(),
  ocupado: z.boolean().optional(),
  gridX: z.coerce.number().int().min(0).nullable().optional(),
  gridY: z.coerce.number().int().min(0).nullable().optional(),
  gridW: z.coerce.number().int().min(1).max(MAX_CAPACIDAD).optional(),
  gridH: z.coerce.number().int().min(1).optional(),
});

const listQuerySchema = z.object({
  fincaId: z.string().min(1, 'La finca es obligatoria'),
});

// Limpia el mapa de metadatos: descarta pares con clave o valor vacíos. Devuelve
// el objeto saneado, o Prisma.DbNull para guardar NULL cuando queda vacío (un campo
// Json? de Prisma no acepta `null` de JS directamente).
function normalizeMetadatos(
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

// Verifica que la finca exista y pertenezca al usuario. Devuelve la finca o null.
async function fincaDelUsuario(fincaId: string, userId: string) {
  return prisma.finca.findFirst({ where: { id: fincaId, userId } });
}

router.get('/', async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const finca = await fincaDelUsuario(parsed.data.fincaId, req.user!.userId);
  if (!finca) return res.status(404).json({ error: 'Finca no encontrada' });

  const potreros = await prisma.potrero.findMany({
    where: { fincaId: finca.id },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ potreros });
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const finca = await fincaDelUsuario(parsed.data.fincaId, req.user!.userId);
  if (!finca) return res.status(404).json({ error: 'Finca no encontrada' });

  const potrero = await prisma.potrero.create({
    data: {
      userId: req.user!.userId,
      fincaId: finca.id,
      nombre: parsed.data.nombre,
      notas: parsed.data.notas ?? null,
      metadatos: normalizeMetadatos(parsed.data.metadatos),
      ocupado: false,
      vacioDesde: new Date(),
    },
  });
  res.status(201).json({ potrero });
});

router.put('/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.potrero.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
    include: { finca: true },
  });
  if (!existing) return res.status(404).json({ error: 'Potrero no encontrado' });

  const d = parsed.data;
  const data: Record<string, unknown> = {};
  if (d.nombre !== undefined) data.nombre = d.nombre;
  if (d.notas !== undefined) data.notas = d.notas;
  if (d.metadatos !== undefined) data.metadatos = normalizeMetadatos(d.metadatos);
  // Al cambiar el estado, marcamos la fecha del cambio: arranca el contador de
  // ocupación o el de descanso (tiempo sin ganado para recuperar el pasto).
  if (d.ocupado !== undefined && d.ocupado !== existing.ocupado) {
    const now = new Date();
    data.ocupado = d.ocupado;
    if (d.ocupado) {
      data.ocupadoDesde = now;
      data.vacioDesde = null;
    } else {
      data.vacioDesde = now;
      data.ocupadoDesde = null;
    }
  }

  const touchesGrid =
    d.gridX !== undefined || d.gridY !== undefined || d.gridW !== undefined || d.gridH !== undefined;
  if (touchesGrid) {
    if (d.gridX !== undefined) data.gridX = d.gridX;
    if (d.gridY !== undefined) data.gridY = d.gridY;
    if (d.gridW !== undefined) data.gridW = d.gridW;
    if (d.gridH !== undefined) data.gridH = d.gridH;

    const x = d.gridX !== undefined ? d.gridX : existing.gridX;
    const y = d.gridY !== undefined ? d.gridY : existing.gridY;
    const w = d.gridW !== undefined ? d.gridW : existing.gridW;
    const h = d.gridH !== undefined ? d.gridH : existing.gridH;

    // El ancho del mapa lo fija la capacidad de la finca. El alto (y) crece libre.
    const cols = existing.finca.capacidad;

    // Solo validamos ubicación cuando el potrero queda colocado (x e y no nulos).
    if (x !== null && y !== null) {
      if (x + w > cols) {
        return res.status(400).json({ error: `El potrero se sale del mapa (máx ${cols} columnas)` });
      }
      const otros = await prisma.potrero.findMany({
        where: {
          fincaId: existing.fincaId,
          id: { not: req.params.id },
          gridX: { not: null },
          gridY: { not: null },
        },
        select: { gridX: true, gridY: true, gridW: true, gridH: true },
      });
      const candidato: Rect = { x, y, w, h };
      const choca = otros.some((o) =>
        rectsOverlap(candidato, { x: o.gridX!, y: o.gridY!, w: o.gridW, h: o.gridH }),
      );
      if (choca) {
        return res.status(400).json({ error: 'El potrero se solapa con otro' });
      }
    }
  }

  const potrero = await prisma.potrero.update({
    where: { id: req.params.id },
    data,
  });
  res.json({ potrero });
});

router.delete('/:id', async (req, res) => {
  const existing = await prisma.potrero.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });
  if (!existing) return res.status(404).json({ error: 'Potrero no encontrado' });
  await prisma.potrero.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
