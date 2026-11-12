import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from './env.js';

// Cifrado simétrico (AES-256-GCM) para secretos que se guardan en la base, como el
// token del bot de Telegram de cada cuenta. Formato: iv.tag.datos en base64url.

function llave(): Buffer {
  if (!env.TELEGRAM_TOKEN_KEY) throw new Error('Falta TELEGRAM_TOKEN_KEY');
  return createHash('sha256').update(env.TELEGRAM_TOKEN_KEY).digest();
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', llave(), iv);
  const datos = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), datos].map((b) => b.toString('base64url')).join('.');
}

export function descifrar(guardado: string): string {
  const [iv, tag, datos] = guardado.split('.').map((p) => Buffer.from(p, 'base64url'));
  const d = createDecipheriv('aes-256-gcm', llave(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(datos), d.final()]).toString('utf8');
}
