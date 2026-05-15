import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { env } from '../lib/env.js';

const router = Router();
router.use(requireAuth);

const uploadDir = path.resolve(env.UPLOAD_DIR);
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Solo imágenes'));
    cb(null, true);
  },
});

// Subir foto a un lote o a un animal
router.post('/', upload.single('foto'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo faltante (campo "foto")' });

  const { loteId, animalId } = req.body as { loteId?: string; animalId?: string };
  if (!loteId && !animalId) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Debe especificar loteId o animalId' });
  }

  // Validar ownership
  if (animalId) {
    const animal = await prisma.animal.findUnique({
      where: { id: animalId },
      include: { lote: true },
    });
    if (!animal || animal.lote.userId !== req.user!.userId) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Animal no encontrado' });
    }
  } else if (loteId) {
    const lote = await prisma.lote.findFirst({
      where: { id: loteId, userId: req.user!.userId },
    });
    if (!lote) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Lote no encontrado' });
    }
  }

  const foto = await prisma.foto.create({
    data: {
      loteId: loteId ?? null,
      animalId: animalId ?? null,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
    },
  });
  res.status(201).json({ foto });
});

router.delete('/:id', async (req, res) => {
  const foto = await prisma.foto.findUnique({
    where: { id: req.params.id },
    include: { lote: true, animal: { include: { lote: true } } },
  });
  if (!foto) return res.status(404).json({ error: 'Foto no encontrada' });

  const ownerId = foto.lote?.userId ?? foto.animal?.lote.userId;
  if (ownerId !== req.user!.userId) {
    return res.status(404).json({ error: 'Foto no encontrada' });
  }

  const filePath = path.join(uploadDir, foto.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  await prisma.foto.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
