import Anthropic from '@anthropic-ai/sdk';
import { env } from '../lib/env.js';
import { ejecutarTool, toolDefs, type Usuario } from './tools.js';

// El agente que registra los movimientos de la finca desde el chat. Una
// conversación por chat de Telegram, en memoria. El historial es solo-agregar
// (los bloques de thinking quedan atados al prefijo exacto): cuando crece mucho se
// arranca una conversación nueva en vez de recortarla.

const SYSTEM = `Eres el asistente de miganado, una app para manejar ceba de ganado en Colombia (Córdoba). Hablas con el dueño o el cuidador de la finca por Telegram, casi siempre desde el celular en el campo.

Tu trabajo es REGISTRAR en la app lo que te cuentan (compras, pesajes, gastos, fletes, ventas, movimientos de potrero, notas) usando las tools, y responder preguntas con los datos reales.

Cómo trabajar:
- Resuelve nombres a ids tú mismo con listar_fincas, ver_finca, listar_lotes y ver_lote. No le pidas ids al usuario.
- Si el dato está claro, regístralo de una y confirma en una línea qué quedó registrado (lote, monto, fecha). Si es ambiguo (no sabes qué lote, falta el monto), pregunta UNA cosa corta.
- Antes de registrar una venta o de borrar algo, muestra el resumen y espera un "sí".
- Un flete que llevó varios lotes en el mismo camión va con registrar_flete (se reparte por cabeza); no lo dupliques con registrar_gasto.
- Fechas: si no dicen, es hoy. "ayer", "el lunes" conviértelas a YYYY-MM-DD con la fecha de hoy que viene en cada mensaje.
- Montos en pesos colombianos. "2 palos" = 2.000.000, "500 mil" = 500.000. Muestra plata como $1.250.000.
- Sexos: ML macho de levante, MC macho de ceba, HL hembra de levante, HV novilla, VP vaca parida, TO toro.
- Si una tool devuelve error, explícalo en simple (p. ej. "solo el dueño puede registrar ventas").
- Respuestas cortas, texto plano, sin tablas ni markdown pesado. Nunca inventes datos que no vengan de las tools.
- Cuando el usuario quiera "ver" la finca, pásale el linkMapa que trae ver_finca.`;

const MAX_MENSAJES = 80; // pasado esto se arranca una conversación nueva
const MAX_VUELTAS = 15; // tope de rondas de tools por mensaje

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
const conversaciones = new Map<string, Anthropic.MessageParam[]>();

// La última tool lleva el breakpoint de caché: tools + system son estables y se reusan.
const tools: Anthropic.Tool[] = toolDefs.map((t, i) =>
  i === toolDefs.length - 1 ? { ...t, cache_control: { type: 'ephemeral' } } : t,
);

export function reiniciarConversacion(chatId: string) {
  conversaciones.delete(chatId);
}

export async function responder(chatId: string, usuario: Usuario & { nombre: string }, texto: string): Promise<string> {
  let messages = conversaciones.get(chatId) ?? [];
  if (messages.length > MAX_MENSAJES) messages = [];
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  messages.push({ role: 'user', content: `[hoy ${hoy} · habla ${usuario.nombre}]\n${texto}` });
  conversaciones.set(chatId, messages);

  try {
    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
      const res = await client.messages.create({
        model: env.AGENTE_MODEL,
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        system: SYSTEM,
        tools,
        messages,
      });
      messages.push({ role: 'assistant', content: res.content });

      if (res.stop_reason === 'refusal') {
        reiniciarConversacion(chatId);
        return 'No puedo ayudar con eso. Empecemos de nuevo.';
      }
      if (res.stop_reason === 'pause_turn') continue;

      const usos = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      if (res.stop_reason !== 'tool_use' || usos.length === 0) {
        const respuesta = res.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim();
        return respuesta || 'Listo.';
      }

      const resultados: Anthropic.ToolResultBlockParam[] = await Promise.all(
        usos.map(async (u) => {
          try {
            return { type: 'tool_result' as const, tool_use_id: u.id, content: await ejecutarTool(usuario, u.name, u.input) };
          } catch (e) {
            return { type: 'tool_result' as const, tool_use_id: u.id, content: (e as Error).message, is_error: true };
          }
        }),
      );
      messages.push({ role: 'user', content: resultados });
    }
    reiniciarConversacion(chatId);
    return 'Me enredé con tantos pasos. Revisa en la app qué quedó registrado y dime de nuevo qué falta.';
  } catch (e) {
    // Un turno a medias deja el historial inconsistente: se descarta la conversación.
    console.error('[agente]', e);
    reiniciarConversacion(chatId);
    return 'Tuve un problema hablando con el asistente. Lo que ya confirmé sí quedó registrado; repíteme lo que faltó.';
  }
}
