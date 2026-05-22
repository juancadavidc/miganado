import { Router } from 'express';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { env } from '../lib/env.js';
import { nombreGrupoDeLote } from '../lib/grupo.js';

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Solo imágenes'));
    cb(null, true);
  },
});

const SYSTEM_PROMPT = `Eres un asistente que extrae datos de planillas de "Relación de Cuentas por Cobrar" del centro comercial ganadero (cencogan/feria).

La planilla típicamente tiene una tabla "ENTREGAS - CXC" con columnas:
- Fecha (formato dd mmm. aa, ej. "14may.26")
- No. Feria (3 dígitos)
- Lote (número, suele ir con 3 dígitos)
- Se(xo): códigos VP, HV, HL, ML, MC, TO
- Cant(idad): entero
- Peso Total: kilos
- Peso Prom(edio): kilos por cabeza
- Valor Final: precio $/kg
- Valor Total: $ (peso × valor)
- Deducción: $ (puede ser 0)
- Doc. Referencia: ej. "C 193608"
- Valor a pagar: $

Reglas:
- Devuelve UNA fila por cada renglón de datos en la tabla. NO incluyas la fila de totales/subtotales.
- Convierte la fecha al formato ISO YYYY-MM-DD. Asume que el año "26" es 2026, "25" es 2025, etc.
- Los meses en español: ene=01, feb=02, mar=03, abr=04, may=05, jun=06, jul=07, ago=08, sep=09, oct=10, nov=11, dic=12.
- Quita comas/puntos como separadores de miles. Devuelve números puros.
- Si no puedes leer un campo con certeza, deja la mejor estimación pero NUNCA inventes valores; usa 0 para numéricos faltantes y "" para strings.
- El campo "sexo" debe ser exactamente uno de: VP, HV, HL, ML, MC, TO.`;

const submitTool: Anthropic.Tool = {
  name: 'submit_lotes',
  description: 'Envía las filas extraídas de la planilla.',
  input_schema: {
    type: 'object',
    properties: {
      rows: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            fecha: { type: 'string', description: 'YYYY-MM-DD' },
            numeroFeria: { type: 'string' },
            loteNumero: { type: 'string' },
            sexo: { type: 'string', enum: ['VP', 'HV', 'HL', 'ML', 'MC', 'TO'] },
            cantidad: { type: 'integer', minimum: 1 },
            pesoTotal: { type: 'number', minimum: 0 },
            pesoPromedio: { type: 'number', minimum: 0 },
            valorFinal: { type: 'number', minimum: 0 },
            valorTotal: { type: 'number', minimum: 0 },
            deduccion: { type: 'number', minimum: 0 },
            referencia: { type: 'string' },
            valorAPagar: { type: 'number', minimum: 0 },
          },
          required: [
            'fecha', 'numeroFeria', 'loteNumero', 'sexo', 'cantidad',
            'pesoTotal', 'valorFinal', 'valorTotal', 'deduccion',
            'referencia', 'valorAPagar',
          ],
        },
      },
    },
    required: ['rows'],
  },
};

router.post('/extract', upload.single('imagen'), async (req, res, next) => {
  try {
    if (!env.ANTHROPIC_API_KEY) {
      return res.status(503).json({
        error: 'ANTHROPIC_API_KEY no configurada en el backend. Agrégala en backend/.env y reinicia.',
      });
    }
    if (!req.file) return res.status(400).json({ error: 'Archivo faltante (campo "imagen")' });

    const mediaType = req.file.mimetype as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mediaType)) {
      return res.status(400).json({ error: 'Formato de imagen no soportado (usa JPG/PNG/WEBP)' });
    }

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    const result = await client.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 4096,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      tools: [submitTool],
      tool_choice: { type: 'tool', name: 'submit_lotes' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: req.file.buffer.toString('base64'),
              },
            },
            {
              type: 'text',
              text: 'Extrae todas las filas de la tabla ENTREGAS - CXC de esta planilla.',
            },
          ],
        },
      ],
    });

    const toolUse = result.content.find((c): c is Anthropic.ToolUseBlock => c.type === 'tool_use');
    if (!toolUse) {
      return res.status(502).json({ error: 'El modelo no devolvió datos estructurados. Intenta con otra imagen.' });
    }
    const input = toolUse.input as { rows: unknown[] };
    res.json({ rows: input.rows ?? [] });
  } catch (err) {
    next(err);
  }
});

const sexoEnum = z.enum(['VP', 'HV', 'HL', 'ML', 'MC', 'TO']);
const bulkRow = z.object({
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
const bulkSchema = z.object({ lotes: z.array(bulkRow).min(1) });

router.post('/bulk', async (req, res) => {
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userId = req.user!.userId;
  // Cada lote importado crea su grupo de ganado (sin ubicar todavía) para que el
  // ganadero pueda asignarlo luego a un potrero. Transacción interactiva porque el
  // grupo necesita el id del lote recién creado.
  const created = await prisma.$transaction(async (tx) => {
    const lotes = [];
    for (const d of parsed.data.lotes) {
      const lote = await tx.lote.create({
        data: {
          userId,
          fecha: new Date(d.fecha),
          numeroFeria: d.numeroFeria ?? null,
          loteNumero: d.loteNumero ?? null,
          sexo: d.sexo,
          cantidad: d.cantidad,
          pesoTotal: d.pesoTotal,
          pesoPromedio: d.pesoPromedio ?? null,
          valorFinal: d.valorFinal,
          valorTotal: d.valorTotal,
          deduccion: d.deduccion,
          referencia: d.referencia ?? null,
          valorAPagar: d.valorAPagar,
          criasMacho: d.criasMacho,
          criasHembra: d.criasHembra,
          notas: d.notas ?? null,
        },
      });
      await tx.grupo.create({
        data: {
          userId,
          nombre: nombreGrupoDeLote(lote),
          sexo: lote.sexo,
          cantidad: lote.cantidad,
          loteId: lote.id,
        },
      });
      lotes.push(lote);
    }
    return lotes;
  });
  res.status(201).json({ lotes: created });
});

export default router;
