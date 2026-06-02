import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Truck, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { Lote } from '../types';
import { fmtDate, fmtMoney } from '../lib/format';
import { SexoBadge } from '../components/SexoBadge';

// Sección de operaciones masivas. Por ahora una sola acción (repartir el flete
// de un viaje entre los lotes que viajaron); está armada para sumar más.
export function BulkPage() {
  const [modal, setModal] = useState<null | 'transporte'>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  return (
    <div className="container">
      <header className="page-header">
        <div>
          <h1>Operaciones masivas</h1>
          <p className="subtitle">Acciones que tocan varios lotes a la vez</p>
        </div>
      </header>

      {hecho && (
        <div className="card" role="status" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', borderColor: 'var(--color-primary)' }}>
          <CheckCircle2 size={18} style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
          <span>{hecho}</span>
        </div>
      )}

      <section className="stack" style={{ marginTop: 'var(--space-3)' }}>
        <button type="button" className="card accion-bulk" onClick={() => { setHecho(null); setModal('transporte'); }}>
          <span className="ico"><Truck size={20} aria-hidden="true" /></span>
          <span style={{ textAlign: 'left' }}>
            <span style={{ display: 'block', fontWeight: 600 }}>Agregar gastos de transporte</span>
            <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
              Reparte el flete de un viaje entre los lotes que viajaron, por cabeza.
            </span>
          </span>
        </button>
      </section>

      {modal === 'transporte' && (
        <GastoTransporteModal
          onClose={() => setModal(null)}
          onDone={(msg) => { setHecho(msg); setModal(null); }}
        />
      )}
    </div>
  );
}

function GastoTransporteModal({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [descripcion, setDescripcion] = useState('Transporte');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ lotes: Lote[] }>('/api/lotes')
      .then((d) => setLotes(d.lotes))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar los lotes'))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && !saving) onClose(); }
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [saving, onClose]);

  function toggle(id: string) {
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const cabezas = useMemo(
    () => lotes.filter((l) => sel.has(l.id)).reduce((s, l) => s + l.cantidad, 0),
    [lotes, sel],
  );
  const montoNum = Number(monto);
  const porCabeza = cabezas > 0 && montoNum > 0 ? montoNum / cabezas : 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sel.size === 0) { setError('Selecciona al menos un lote que haya viajado'); return; }
    if (!(montoNum > 0)) { setError('Ingresa el monto total del flete'); return; }
    setError(null);
    setSaving(true);
    try {
      await api('/api/bulk/gastos-transporte', {
        method: 'POST',
        body: { loteIds: [...sel], montoTotal: montoNum, fecha, descripcion: descripcion.trim() || undefined },
      });
      onDone(`Flete de ${fmtMoney(montoNum)} repartido entre ${sel.size} lote${sel.size > 1 ? 's' : ''} (${cabezas} cab.).`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
      setSaving(false);
    }
  }

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="transporte-title"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
          <h2 id="transporte-title" style={{ margin: 0 }}>Gastos de transporte</h2>
          <button type="button" className="btn-ghost btn-icon" onClick={onClose} aria-label="Cerrar" disabled={saving}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="field">
            <label>Lotes que viajaron</label>
            {cargando ? (
              <p className="muted" style={{ margin: 0 }}>Cargando lotes…</p>
            ) : lotes.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>No tienes lotes para seleccionar.</p>
            ) : (
              <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-1)' }}>
                {lotes.map((l) => (
                  <label key={l.id} className="row" style={{ gap: 'var(--space-2)', padding: 'var(--space-2)', cursor: 'pointer', alignItems: 'center' }}>
                    <input type="checkbox" checked={sel.has(l.id)} onChange={() => toggle(l.id)} />
                    <SexoBadge sexo={l.sexo} />
                    <span style={{ flex: 1 }}>
                      <span style={{ fontWeight: 500 }}>{l.cantidad} cab.</span>
                      <span className="muted" style={{ fontSize: 'var(--text-sm)', marginLeft: 6 }}>
                        {fmtDate(l.fecha)} · Feria {l.numeroFeria ?? '—'} · Lote {l.loteNumero ?? '—'}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="row" style={{ gap: 'var(--space-3)' }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="t-monto">Monto total del flete ($)</label>
              <input id="t-monto" type="number" step="1" min={0} value={monto}
                onChange={(e) => setMonto(e.target.value)} placeholder="ej. 350000" inputMode="numeric" />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="t-fecha">Fecha del viaje</label>
              <input id="t-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="t-desc">Descripción</label>
            <input id="t-desc" type="text" value={descripcion} maxLength={255}
              onChange={(e) => setDescripcion(e.target.value)} placeholder="ej. Flete Buenavista → finca" />
          </div>

          {cabezas > 0 && (
            <p className="muted" style={{ margin: '0 0 var(--space-3)' }}>
              {cabezas} cab. en {sel.size} lote{sel.size > 1 ? 's' : ''}
              {porCabeza > 0 && <> · <strong>{fmtMoney(porCabeza)}/cab.</strong></>}
            </p>
          )}

          {error && (
            <div className="error" role="alert">
              <AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
              {error}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" disabled={saving || cargando}>{saving ? 'Guardando…' : 'Repartir flete'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
