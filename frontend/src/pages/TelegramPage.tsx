import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Send } from 'lucide-react';
import { api } from '../api/client';

// Bot de Telegram propio de la cuenta: se crea en @BotFather, se pega el token
// acá y se vincula el chat con un link de un solo uso. Desde ahí, todo lo que se
// le escriba al bot lo registra el asistente como esta cuenta.

type Estado = { disponible: boolean; configurado: boolean; botUsername: string | null; vinculado: boolean };

export function TelegramPage() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [token, setToken] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    api<Estado>('/api/telegram').then(setEstado).catch((e) => setError(e.message));
  }, []);

  // Mientras hay un link abierto, revisa cada pocos segundos si ya se vinculó.
  useEffect(() => {
    if (!link || estado?.vinculado) return;
    const t = window.setInterval(() => {
      api<Estado>('/api/telegram').then((e) => {
        setEstado(e);
        if (e.vinculado) setLink(null);
      }).catch(() => {});
    }, 3000);
    return () => window.clearInterval(t);
  }, [link, estado?.vinculado]);

  async function correr(fn: () => Promise<void>) {
    setError(null);
    setOcupado(true);
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setOcupado(false); }
  }

  const guardar = (e: FormEvent) => {
    e.preventDefault();
    correr(async () => {
      setEstado(await api<Estado>('/api/telegram', { method: 'PUT', body: { token } }));
      setToken('');
      setLink(null);
    });
  };

  const vincular = () =>
    correr(async () => {
      const r = await api<{ link: string }>('/api/telegram/codigo', { method: 'POST' });
      setLink(r.link);
      window.open(r.link, '_blank', 'noopener');
    });

  const quitar = () =>
    correr(async () => {
      if (!window.confirm('¿Quitar el bot de tu cuenta? Dejará de registrar lo que le escribas.')) return;
      setEstado(await api<Estado>('/api/telegram', { method: 'DELETE' }));
      setLink(null);
    });

  return (
    <div className="container" style={{ maxWidth: 560 }}>
      <h1>Telegram</h1>
      <p className="muted" style={{ marginBottom: 'var(--space-4)' }}>
        Conecta tu propio bot y regístrale a él todo lo que pasa en la finca: pesajes, gastos, fletes, ventas,
        cambios de potrero.
      </p>

      {error && (
        <div className="error" role="alert" style={{ marginBottom: 'var(--space-3)' }}>
          <AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
          {error}
        </div>
      )}

      {!estado && !error && <p className="muted">Cargando…</p>}

      {estado && !estado.disponible && (
        <div className="card">Telegram todavía no está habilitado en este servidor.</div>
      )}

      {estado?.disponible && !estado.configurado && (
        <form className="card" onSubmit={guardar}>
          <ol style={{ paddingLeft: '1.2rem', marginBottom: 'var(--space-4)', lineHeight: 1.6 }}>
            <li>En Telegram abre <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather</a> y escribe <code>/newbot</code>.</li>
            <li>Ponle un nombre y un usuario que termine en <code>bot</code>.</li>
            <li>Copia el token que te da y pégalo aquí.</li>
          </ol>
          <div className="field">
            <label htmlFor="token">Token del bot</label>
            <input
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456789:AA…"
              autoComplete="off"
              spellCheck={false}
              required
            />
          </div>
          <button type="submit" className="btn-block" disabled={ocupado || !token.trim()}>
            {ocupado ? 'Revisando…' : 'Conectar bot'}
          </button>
        </form>
      )}

      {estado?.disponible && estado.configurado && (
        <div className="card">
          <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
            <strong>@{estado.botUsername}</strong>
            <span className={`badge ${estado.vinculado ? 'is-libre' : 'is-ocupado'}`}>
              {estado.vinculado ? 'Vinculado' : 'Sin vincular'}
            </span>
          </div>
          {estado.vinculado ? (
            <>
              <p className="muted" style={{ marginBottom: 'var(--space-4)' }}>
                Listo: escríbele a tu bot lo que pasó y él lo registra.
              </p>
              <a className="btn btn-block" href={`https://t.me/${estado.botUsername}`} target="_blank" rel="noreferrer">
                <Send size={16} aria-hidden="true" /> Abrir mi bot
              </a>
            </>
          ) : (
            <>
              <p className="muted" style={{ marginBottom: 'var(--space-4)' }}>
                Abre el bot desde este botón y toca <strong>Iniciar</strong>: así queda conectado a tu chat.
              </p>
              <button type="button" className="btn-block" onClick={vincular} disabled={ocupado}>
                <Send size={16} aria-hidden="true" /> Vincular mi Telegram
              </button>
              {link && (
                <p className="muted" style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-xs)', wordBreak: 'break-all' }}>
                  ¿No se abrió? <a href={link} target="_blank" rel="noreferrer">{link}</a> (vence en 15 minutos)
                </p>
              )}
            </>
          )}
          <div className="divider" style={{ margin: 'var(--space-4) 0 var(--space-3)' }} />
          <button type="button" className="btn-ghost btn-sm" onClick={quitar} disabled={ocupado}>
            Quitar bot
          </button>
        </div>
      )}
    </div>
  );
}
