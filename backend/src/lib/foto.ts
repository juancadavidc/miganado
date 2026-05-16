import type { Foto } from '@prisma/client';
import { r2PublicUrl } from './r2.js';

export type FotoConUrl = Foto & { url: string };

export function withUrl(foto: Foto): FotoConUrl {
  return { ...foto, url: r2PublicUrl(foto.filename) };
}
