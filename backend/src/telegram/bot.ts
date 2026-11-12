import { env } from '../lib/env.js';
import { prisma } from '../lib/prisma.js';
import { descifrar } from '../lib/cifrado.js';
import { reiniciarConversacion, responder } from './agent.js';

// Cada cuenta trae su propio bot de Telegram. El backend escucha todos por long
// polling (sin webhook): un bucle por bot, que se prende o apaga cuando la cuenta
// guarda o quita su token. El bot de una cuenta actúa solo como esa cuenta y solo
// le responde al chat que se vinculó desde la app con un código de un solo uso.

export async function tg(token: string, metodo: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{ ok: boolean; result?: any; description?: string; error_code?: number }>;
}

async function enviar(token: string, chatId: string, texto: string) {
  // Telegram corta en 4096 caracteres.
  for (let i = 0; i < texto.length; i += 4000) {
    await tg(token, 'sendMessage', { chat_id: chatId, text: texto.slice(i, i + 4000) });
  }
}

const AYUDA = `Hola, soy el asistente de miganado 🐂
Cuéntame lo que pasa en la finca y yo lo registro. Por ejemplo:
• "Pesé el lote 12: 20 animales, 7.800 kilos"
• "Flete de 1.200.000 para los lotes 12 y 15"
• "Pasé el lote 12 al potrero La Ceiba"
• "Vacuna aftosa al lote 15, 180 mil"

Comandos: /nuevo (olvidar la conversación), /desvincular`;

const PRIVADO = 'Este bot es privado. Si es tuyo, vincúlalo desde la app: menú de usuario → Telegram → "Vincular mi Telegram".';

async function manejar(userId: string, token: string, msg: any) {
  if (msg.chat.type !== 'private') return; // solo chats directos: el bot maneja plata
  const chatId = String(msg.chat.id);
  const texto: string = (msg.text ?? '').trim();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  // Link de la app: /start <código>. El código es de un solo uso y vence.
  const codigo = texto.match(/^\/start\s+(\S+)/)?.[1];
  if (codigo) {
    const valido =
      user.telegramCodigo === codigo && user.telegramCodigoExpira != null && user.telegramCodigoExpira > new Date();
    if (!valido) return enviar(token, chatId, 'Ese link ya venció o no es válido. Genera uno nuevo desde la app.');
    await prisma.user.update({
      where: { id: user.id },
      data: { telegramChatId: chatId, telegramCodigo: null, telegramCodigoExpira: null },
    });
    reiniciarConversacion(`${user.id}:${chatId}`);
    return enviar(token, chatId, `Listo ${user.nombre}, quedaste vinculado. ¿Qué registramos?\n\n${AYUDA}`);
  }

  if (user.telegramChatId !== chatId) return enviar(token, chatId, PRIVADO);

  const clave = `${user.id}:${chatId}`;
  if (texto === '/start' || texto === '/ayuda') return enviar(token, chatId, AYUDA);
  if (texto === '/desvincular') {
    await prisma.user.update({ where: { id: user.id }, data: { telegramChatId: null } });
    reiniciarConversacion(clave);
    return enviar(token, chatId, 'Desvinculado. Este chat ya no puede registrar nada.');
  }
  if (texto === '/nuevo') {
    reiniciarConversacion(clave);
    return enviar(token, chatId, 'Listo, empecemos de cero.');
  }
  if (!texto) return enviar(token, chatId, 'Por ahora solo entiendo texto. Escríbeme lo que pasó.');

  await tg(token, 'sendChatAction', { chat_id: chatId, action: 'typing' });
  const typing = setInterval(() => tg(token, 'sendChatAction', { chat_id: chatId, action: 'typing' }), 4500);
  try {
    const respuesta = await responder(clave, { userId: user.id, documento: user.documento, nombre: user.nombre }, texto);
    await enviar(token, chatId, respuesta);
  } finally {
    clearInterval(typing);
  }
}

// Bots corriendo, por usuario. `activo` en false hace que su bucle termine.
const bots = new Map<string, { activo: boolean }>();
// Un mensaje a la vez por chat, para que el historial no se cruce.
const colas = new Map<string, Promise<void>>();

function encolar(userId: string, token: string, msg: any) {
  const clave = `${userId}:${msg.chat.id}`;
  const prev = colas.get(clave) ?? Promise.resolve();
  const next = prev.then(() => manejar(userId, token, msg)).catch((e) => console.error('[telegram]', e));
  colas.set(clave, next);
  next.finally(() => colas.get(clave) === next && colas.delete(clave));
}

export function detenerBot(userId: string) {
  const bot = bots.get(userId);
  if (bot) bot.activo = false;
  bots.delete(userId);
}

export function iniciarBot(userId: string, token: string) {
  detenerBot(userId);
  const bot = { activo: true };
  bots.set(userId, bot);
  let offset = 0;
  (async () => {
    while (bot.activo) {
      try {
        const r = await tg(token, 'getUpdates', { offset, timeout: 30, allowed_updates: ['message'] });
        if (!bot.activo) break;
        if (r.error_code === 401) {
          // Token revocado en @BotFather: no tiene caso seguir preguntando.
          console.error(`[telegram] token inválido para el usuario ${userId}, bot apagado`);
          bots.delete(userId);
          break;
        }
        if (!r.ok) throw new Error(r.description);
        for (const u of r.result ?? []) {
          offset = u.update_id + 1;
          if (u.message) encolar(userId, token, u.message);
        }
      } catch (e) {
        console.error(`[telegram] polling (${userId})`, (e as Error).message);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  })();
}

export async function iniciarBotsTelegram() {
  if (!env.TELEGRAM_TOKEN_KEY) {
    console.log('telegram: sin TELEGRAM_TOKEN_KEY, bots apagados');
    return;
  }
  const users = await prisma.user.findMany({
    where: { telegramBotToken: { not: null } },
    select: { id: true, telegramBotToken: true },
  });
  for (const u of users) {
    try {
      iniciarBot(u.id, descifrar(u.telegramBotToken!));
    } catch (e) {
      console.error(`[telegram] no se pudo descifrar el token del usuario ${u.id}`, (e as Error).message);
    }
  }
  console.log(`telegram: ${bots.size} bot(s) escuchando`);
}
