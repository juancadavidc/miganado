import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeftRight, Check, X, Clock, AlertCircle, Inbox, Send,
} from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { Traslado, TrasladoRol } from '../types';
import { fmtDate } from '../lib/format';
import { SexoBadge } from '../components/SexoBadge';

function rolLabel(rol: TrasladoRol): string {
  return rol === 'DUENO' ? 'la propiedad (dueño)' : 'el cuidado (cuidador)';
}

export function TrasladosPage() {
  const [recibidos, setRecibidos] = useState<Traslado[]>([]);
  const [enviados, setEnviados] = useState<Traslado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ recibidos: Traslado[]; enviados: Traslado[] }>('/api/traslados');
      setRecibidos(d.recibidos);
      setEnviados(d.enviados);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function accion(t: Traslado, verbo: 'aceptar' | 'rechazar' | 'cancelar') {
    setBusy(t.id);
    setError(null);
    try {
      await api(`/api/traslados/${t.id}/${verbo}`, { method: 'POST' });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="container">
      <header className="page-header">
        <div>
          <h1>Traslados</h1>
          <p className="subtitle">Asignaciones de cuidado y traspasos de propiedad por confirmar</p>
        </div>
      </header>

      {error && (
        <div className="error" role="alert">
          <AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} /> {error}
        </div>
      )}

      {loading ? (
        <p className="muted">Cargando…</p>
      ) : (
        <>
          <section className="card" style={{ marginBottom: 'var(--space-4)' }}>
            <h2 className="row" style={{ gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <Inbox size={18} aria-hidden="true" />
              Para aceptar
              <span className="muted tabnum">({recibidos.length})</span>
            </h2>
            {recibidos.length === 0 ? (
              <p className="muted">No tenés traslados pendientes por aceptar.</p>
            ) : (
              <div className="stack">
                {recibidos.map((t) => (
                  <div key={t.id} className="card" style={{ background: 'var(--color-surface-2)' }}>
                    <div style={{ marginBottom: 'var(--space-2)' }}>
                      <strong>{t.creadoPor?.nombre}</strong>
                      {' te ofrece '}{rolLabel(t.rol)}{' del '}
                      <LoteResumen t={t} />
                    </div>
                    {t.mensaje && <p className="muted" style={{ marginTop: 0 }}>“{t.mensaje}”</p>}
                    <div className="row" style={{ gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={busy === t.id}
                        onClick={() => accion(t, 'rechazar')}
                      >
                        <X size={16} aria-hidden="true" /> Rechazar
                      </button>
                      <button
                        type="button"
                        disabled={busy === t.id}
                        onClick={() => accion(t, 'aceptar')}
                      >
                        <Check size={16} aria-hidden="true" /> Aceptar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h2 className="row" style={{ gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <Send size={18} aria-hidden="true" />
              Enviados (pendientes)
              <span className="muted tabnum">({enviados.length})</span>
            </h2>
            {enviados.length === 0 ? (
              <p className="muted">No tenés traslados enviados a la espera de respuesta.</p>
            ) : (
              <div className="stack">
                {enviados.map((t) => (
                  <div key={t.id} className="card row-between" style={{ background: 'var(--color-surface-2)' }}>
                    <div className="row" style={{ gap: 'var(--space-2)' }}>
                      <Clock size={14} aria-hidden="true" />
                      <span>
                        Le ofreciste {rolLabel(t.rol)} del{' '}
                        <Link to={`/lotes/${t.loteId}`}>lote {t.lote?.loteNumero ?? '—'}</Link>
                        {' a '}<strong>{t.para?.nombre}</strong> — esperando respuesta.
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      disabled={busy === t.id}
                      onClick={() => accion(t, 'cancelar')}
                    >
                      Cancelar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function LoteResumen({ t }: { t: Traslado }) {
  const l = t.lote;
  if (!l) return <>lote</>;
  return (
    <span className="row" style={{ gap: 'var(--space-2)', display: 'inline-flex', verticalAlign: 'middle' }}>
      <ArrowLeftRight size={13} aria-hidden="true" />
      lote <strong>{l.loteNumero ?? '—'}</strong>
      <SexoBadge sexo={l.sexo} />
      <span className="muted">· {l.cantidad} cab. · {fmtDate(l.fecha)}</span>
    </span>
  );
}
