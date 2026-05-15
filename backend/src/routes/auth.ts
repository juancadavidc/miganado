import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  documento: z.string().min(4).max(32),
  nombre: z.string().min(2).max(120),
  password: z.string().min(6).max(128),
});

const loginSchema = z.object({
  documento: z.string().min(1),
  password: z.string().min(1),
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { documento, nombre, password } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { documento } });
  if (exists) return res.status(409).json({ error: 'El documento ya está registrado' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { documento, nombre, passwordHash },
    select: { id: true, documento: true, nombre: true },
  });
  const token = signToken({ userId: user.id, documento: user.documento });
  res.status(201).json({ user, token });
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { documento, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { documento } });
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

  const token = signToken({ userId: user.id, documento: user.documento });
  res.json({
    user: { id: user.id, documento: user.documento, nombre: user.nombre },
    token,
  });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, documento: true, nombre: true, createdAt: true },
  });
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ user });
});

export default router;
