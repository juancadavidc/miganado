import bcrypt from 'bcryptjs';
import { env } from '../lib/env.js';
import { prisma } from '../lib/prisma.js';
import { reiniciarConversacion, responder } from './agent.js';

// Bot de Telegram por long polling (sin webhook ni dependencias): el backend corre
// una sola instancia, así que basta con preguntarle a Telegram por mensajes nuevos.
// Cada chat se vincula a un usuario de la app con /vincular y desde ahí el agente
// actúa como ese usuario, con sus mismos permisos.

const API = () => `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;

async function tg(metodo: string, body: Record<string, unknown>) {
  const res = await fetch(`${API()}/${metodo}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{ ok: boolean; result?: any; description?: string }>;
}

async function enviar(chatId: string, texto: string) {
  // Telegram corta en 4096 caracteres.
  for (let i = 0; i < texto.length; i += 4000) {
    await tg('sendMessage', { chat_id: chatId, text: texto.slice(i, i + 4000) });
  }
}

const AYUDA = `Hola, soy el asistente de miganado 🐂
Cuéntame lo que pasa en la finca y yo lo registro. Por ejemplo:
• "Pesé el lote 12: 20 animales, 7.800 kilos"
• "Flete de 1.200.000 para los lotes 12 y 15"
• "Pasé el lote 12 al potrero La Ceiba"
• "Vacuna aftosa al lote 15, 180 mil"

Para empezar vincula tu cuenta:
/vincular <documento> <contraseña>

Otros: /nuevo (olvidar la conversación), /desvincular`;

async function manejar(msg: any) {
  const chatId = String(msg.chat.id);
  const texto: string = (msg.text ?? '').trim();
  if (msg.chat.type !== 'private') return; // solo chats directos: el bot maneja plata

  if (texto.startsWith('/vincular')) {
    // El mensaje lleva la contraseña: se borra del chat apenas se lee.
    await tg('deleteMessage', { chat_id: chatId, message_id: msg.message_id });
    const [, documento, password] = texto.split(/\s+/);
    if (!documento || !password) return enviar(chatId, 'Uso: /vincular <documento> <contraseña>');
    const user = await prisma.user.findUnique({ where: { documento } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return enviar(chatId, 'Documento o contraseña incorrectos.');
    }
    await prisma.$transaction([
      prisma.user.updateMany({ where: { telegramChatId: chatId }, data: { telegramChatId: null } }),
      prisma.user.update({ where: { id: user.id }, data: { telegramChatId: chatId } }),
    ]);
    reiniciarConversacion(chatId);
    return enviar(chatId, `Listo ${user.nombre}, quedaste vinculado. Borré tu mensaje con la contraseña. ¿Qué registramos?`);
  }

  const user = await prisma.user.findUnique({ where: { telegramChatId: chatId } });

  if (texto === '/start' || texto === '/ayuda') return enviar(chatId, AYUDA);
  if (!user) return enviar(chatId, 'Primero vincula tu cuenta:\n/vincular <documento> <contraseña>');
  if (texto === '/desvincular') {
    await prisma.user.update({ where: { id: user.id }, data: { telegramChatId: null } });
    reiniciarConversacion(chatId);
    return enviar(chatId, 'Desvinculado. Este chat ya no puede registrar nada.');
  }
  if (texto === '/nuevo') {
    reiniciarConversacion(chatId);
    return enviar(chatId, 'Listo, empecemos de cero.');
  }
  if (!texto) return enviar(chatId, 'Por ahora solo entiendo texto. Escríbeme lo que pasó.');

  await tg('sendChatAction', { chat_id: chatId, action: 'typing' });
  const typing = setInterval(() => tg('sendChatAction', { chat_id: chatId, action: 'typing' }), 4500);
  try {
    const respuesta = await responder(chatId, { userId: user.id, documento: user.documento, nombre: user.nombre }, texto);
    await enviar(chatId, respuesta);
  } finally {
    clearInterval(typing);
  }
}

// Un mensaje a la vez por chat, para que el historial no se cruce.
const colas = new Map<string, Promise<void>>();
function encolar(msg: any) {
  const chatId = String(msg.chat.id);
  const prev = colas.get(chatId) ?? Promise.resolve();
  const next = prev.then(() => manejar(msg)).catch((e) => console.error('[telegram]', e));
  colas.set(chatId, next);
  next.finally(() => colas.get(chatId) === next && colas.delete(chatId));
}

export function iniciarBotTelegram() {
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.log('telegram: sin TELEGRAM_BOT_TOKEN, bot apagado');
    return;
  }
  if (!env.ANTHROPIC_API_KEY) console.warn('telegram: falta ANTHROPIC_API_KEY, el agente no podrá responder');
  let offset = 0;
  (async function loop() {
    console.log('telegram: bot escuchando (long polling)');
    for (;;) {
      try {
        const r = await tg('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] });
        if (!r.ok) throw new Error(r.description);
        for (const u of r.result ?? []) {
          offset = u.update_id + 1;
          if (u.message) encolar(u.message);
        }
      } catch (e) {
        console.error('[telegram] polling', (e as Error).message);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  })();
}
