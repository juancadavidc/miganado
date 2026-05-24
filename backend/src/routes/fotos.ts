import { Router } from 'express';
import path from 'node:path';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { r2Put, r2Delete } from '../lib/r2.js';
import { withUrl } from '../lib/foto.js';
import { puedeOperar, rolesEnLote } from '../lib/loteAccess.js';

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Solo imágenes'));
    cb(null, true);
  },
});

function makeKey(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
}

// Subir foto a un lote o a un animal
router.post('/', upload.single('foto'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo faltante (campo "foto")' });

  const { loteId, animalId } = req.body as { loteId?: string; animalId?: string };
  if (!loteId && !animalId) {
    return res.status(400).json({ error: 'Debe especificar loteId o animalId' });
  }

  // Validar acceso (dueño o cuidador)
  if (animalId) {
    const animal = await prisma.animal.findUnique({
      where: { id: animalId },
      include: { lote: { select: { duenoId: true, cuidadorId: true } } },
    });
    if (!animal || !puedeOperar(animal.lote, req.user!.userId)) {
      return res.status(404).json({ error: 'Animal no encontrado' });
    }
  } else if (loteId) {
    if (!(await rolesEnLote(req.user!.userId, loteId))) {
      return res.status(404).json({ error: 'Lote no encontrado' });
    }
  }

  const key = makeKey(req.file.originalname);
  await r2Put(key, req.file.buffer, req.file.mimetype);

  const foto = await prisma.foto.create({
    data: {
      loteId: loteId ?? null,
      animalId: animalId ?? null,
      filename: key,
      mimetype: req.file.mimetype,
      size: req.file.size,
    },
  });
  res.status(201).json({ foto: withUrl(foto) });
});

router.delete('/:id', async (req, res) => {
  const foto = await prisma.foto.findUnique({
    where: { id: req.params.id },
    include: {
      lote: { select: { duenoId: true, cuidadorId: true } },
      animal: { include: { lote: { select: { duenoId: true, cuidadorId: true } } } },
    },
  });
  if (!foto) return res.status(404).json({ error: 'Foto no encontrada' });

  const loteRoles = foto.lote ?? foto.animal?.lote;
  if (!loteRoles || !puedeOperar(loteRoles, req.user!.userId)) {
    return res.status(404).json({ error: 'Foto no encontrada' });
  }

  await r2Delete(foto.filename);
  await prisma.foto.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
