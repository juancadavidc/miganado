import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';
import { cifrar } from '../lib/cifrado.js';
import { requireAuth } from '../middleware/auth.js';
import { detenerBot, iniciarBot, tg } from '../telegram/bot.js';

// Configuración del bot de Telegram propio de la cuenta: guardar/quitar el token
// (creado por el usuario en @BotFather) y generar el link para vincular su chat.
const router = Router();
router.use(requireAuth);

const CODIGO_MINUTOS = 15;

async function estado(userId: string) {
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { telegramBotToken: true, telegramBotUsername: true, telegramChatId: true },
  });
  return {
    disponible: !!env.TELEGRAM_TOKEN_KEY,
    configurado: !!u.telegramBotToken,
    botUsername: u.telegramBotUsername,
    vinculado: !!u.telegramChatId,
  };
}

router.get('/', async (req, res) => {
  res.json(await estado(req.user!.userId));
});

router.put('/', async (req, res) => {
  if (!env.TELEGRAM_TOKEN_KEY) return res.status(503).json({ error: 'Telegram no está habilitado en este servidor' });
  const parsed = z.object({ token: z.string().trim().regex(/^\d+:[\w-]+$/, 'Ese no parece un token de bot') }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { token } = parsed.data;
  const me = await tg(token, 'getMe');
  if (!me.ok) return res.status(400).json({ error: 'Telegram no reconoce ese token. Cópialo de nuevo desde @BotFather.' });

  const botId = String(me.result.id);
  const otro = await prisma.user.findFirst({ where: { telegramBotId: botId, id: { not: req.user!.userId } } });
  if (otro) return res.status(409).json({ error: 'Ese bot ya está conectado a otra cuenta' });

  await prisma.user.update({
    where: { id: req.user!.userId },
    data: {
      telegramBotToken: cifrar(token),
      telegramBotId: botId,
      telegramBotUsername: me.result.username,
      telegramChatId: null, // bot nuevo: hay que vincular el chat de nuevo
      telegramCodigo: null,
      telegramCodigoExpira: null,
    },
  });
  iniciarBot(req.user!.userId, token);
  res.json(await estado(req.user!.userId));
});

router.delete('/', async (req, res) => {
  detenerBot(req.user!.userId);
  await prisma.user.update({
    where: { id: req.user!.userId },
    data: {
      telegramBotToken: null,
      telegramBotId: null,
      telegramBotUsername: null,
      telegramChatId: null,
      telegramCodigo: null,
      telegramCodigoExpira: null,
    },
  });
  res.json(await estado(req.user!.userId));
});

// Link de un solo uso para vincular el chat: al abrirlo, Telegram le manda al bot
// "/start <código>" y el bot deja ese chat como el de la cuenta.
router.post('/codigo', async (req, res) => {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.userId }, select: { telegramBotUsername: true } });
  if (!u.telegramBotUsername) return res.status(400).json({ error: 'Primero conecta tu bot' });
  const codigo = randomBytes(12).toString('base64url');
  await prisma.user.update({
    where: { id: req.user!.userId },
    data: { telegramCodigo: codigo, telegramCodigoExpira: new Date(Date.now() + CODIGO_MINUTOS * 60_000) },
  });
  res.json({ link: `https://t.me/${u.telegramBotUsername}?start=${codigo}`, expiraEnMinutos: CODIGO_MINUTOS });
});

export default router;
