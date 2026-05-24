import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, LandPlot, Fence, Pencil, Trash2, AlertCircle, X, ChevronRight, Users,
} from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { Finca } from '../types';
import { useConfirm } from '../components/ConfirmDialog';
import { useAuth } from '../auth/AuthContext';

type ModalState =
  | { open: false }
  | { open: true; mode: 'crear' }
  | { open: true; mode: 'editar'; target: Finca };

type MetaPair = { key: string; value: string };

const CAPACIDADES = [16, 32, 64] as const;

// Sugerencias de propiedades comunes de una finca; las claves siguen siendo libres.
const PROP_SUGERENCIAS = [
  'Ubicación',
  'Área total',
  'Municipio',
  'Vereda',
  'Tipo de explotación',
  'Matrícula',
];

export function FincasPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const meId = user?.id;
  const [fincas, setFincas] = useState<Finca[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [busyId, setBusyId] = useState<string | null>(null);
  const { ask, dialog } = useConfirm();

  useEffect(() => {
    api<{ fincas: Finca[] }>('/api/fincas')
      .then((d) => setFincas(d.fincas))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error'))
      .finally(() => setLoading(false));
  }, []);

  function upsert(f: Finca) {
    setFincas((list) => {
      const idx = list.findIndex((x) => x.id === f.id);
      if (idx === -1) return [...list, f];
      const next = [...list];
      // Conservar el conteo de potreros si el update no lo trae.
      next[idx] = { ...f, _count: f._count ?? next[idx]._count };
      return next;
    });
  }

  async function eliminar(f: Finca) {
    const ok = await ask({
      title: `Eliminar "${f.nombre}"`,
      description: 'Se eliminará la finca y todos sus potreros. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;
    setBusyId(f.id);
    try {
      await api(`/api/fincas/${f.id}`, { method: 'DELETE' });
      setFincas((list) => list.filter((x) => x.id !== f.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="container">
      <header className="page-header">
        <div>
          <h1>Fincas</h1>
          <p className="subtitle">Tus fincas y los potreros que contienen</p>
        </div>
        <button type="button" className="btn" onClick={() => setModal({ open: true, mode: 'crear' })}>
          <Plus size={16} aria-hidden="true" />
          Nueva finca
        </button>
      </header>

      {error && (
        <div className="error" role="alert">
          <AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
          {error}
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : fincas.length === 0 ? (
        <EmptyState onCrear={() => setModal({ open: true, mode: 'crear' })} />
      ) : (
        <section className="potrero-grid">
          {fincas.map((f) => (
            <article
              key={f.id}
              className="potrero-card finca-card"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/fincas/${f.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/fincas/${f.id}`); }
              }}
            >
              <div className="potrero-card-head">
                <span className="potrero-icon" aria-hidden="true"><LandPlot size={18} /></span>
                <span className="row" style={{ gap: 'var(--space-1)' }}>
                  {meId && f.cuidador?.id === meId && f.dueno?.id !== meId && (
                    <span className="badge" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}>Cuido</span>
                  )}
                  <span className="badge">{f.capacidad}×{f.capacidad}</span>
                </span>
              </div>

              <h3 className="potrero-nombre">{f.nombre}</h3>

              <div className="potrero-stat">
                <Fence size={14} aria-hidden="true" />
                <span><strong>{f._count?.potreros ?? 0}</strong> {f._count?.potreros === 1 ? 'potrero' : 'potreros'}</span>
              </div>

              {f.cuidador && f.cuidador.id !== f.dueno?.id && (
                <div className="potrero-stat">
                  <Users size={14} aria-hidden="true" />
                  <span>Cuidador: <strong>{f.cuidador.nombre}</strong></span>
                </div>
              )}

              {f.propiedades && Object.keys(f.propiedades).length > 0 && (
                <dl className="potrero-meta">
                  {Object.entries(f.propiedades).map(([k, v]) => (
                    <div className="potrero-meta-item" key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              )}

              <div className="potrero-actions">
                <span className="muted finca-open">
                  Abrir mapa <ChevronRight size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} />
                </span>
                <div className="nav-spacer" />
                <button
                  type="button"
                  className="btn-ghost btn-icon"
                  onClick={(e) => { e.stopPropagation(); setModal({ open: true, mode: 'editar', target: f }); }}
                  aria-label={`Editar ${f.nombre}`}
                  disabled={busyId === f.id}
                >
                  <Pencil size={16} />
                </button>
                {f.dueno?.id === meId && (
                  <button
                    type="button"
                    className="btn-ghost btn-icon"
                    onClick={(e) => { e.stopPropagation(); eliminar(f); }}
                    aria-label={`Eliminar ${f.nombre}`}
                    disabled={busyId === f.id}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      {modal.open && (
        <FincaModal
          target={modal.mode === 'editar' ? modal.target : null}
          onClose={() => setModal({ open: false })}
          onSaved={(f) => { upsert(f); setModal({ open: false }); }}
        />
      )}
      {dialog}
    </div>
  );
}

function FincaModal({
  target,
  onClose,
  onSaved,
}: {
  target: Finca | null;
  onClose: () => void;
  onSaved: (f: Finca) => void;
}) {
  const [nombre, setNombre] = useState(target?.nombre ?? '');
  const [capacidad, setCapacidad] = useState<number>(target?.capacidad ?? 16);
  const [props, setProps] = useState<MetaPair[]>(() => {
    const p = target?.propiedades;
    return p && Object.keys(p).length > 0
      ? Object.entries(p).map(([key, value]) => ({ key, value }))
      : [];
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updatePair(i: number, field: keyof MetaPair, val: string) {
    setProps((rows) => rows.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));
  }
  function addPair() {
    setProps((rows) => [...rows, { key: '', value: '' }]);
  }
  function removePair(i: number) {
    setProps((rows) => rows.filter((_, idx) => idx !== i));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose();
    }
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [saving, onClose]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setError(null);
    setSaving(true);
    try {
      const propiedades: Record<string, string> = {};
      for (const { key, value } of props) {
        const k = key.trim();
        const v = value.trim();
        if (k && v) propiedades[k] = v;
      }
      const propPayload = Object.keys(propiedades).length > 0 ? propiedades : null;
      const d = target
        ? await api<{ finca: Finca }>(`/api/fincas/${target.id}`, {
            method: 'PUT',
            body: { nombre: nombre.trim(), propiedades: propPayload },
          })
        : await api<{ finca: Finca }>('/api/fincas', {
            method: 'POST',
            body: { nombre: nombre.trim(), capacidad, propiedades: propPayload },
          });
      onSaved(d.finca);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
      setSaving(false);
    }
  }

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="finca-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="modal">
        <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
          <h2 id="finca-modal-title" style={{ margin: 0 }}>
            {target ? 'Editar finca' : 'Nueva finca'}
          </h2>
          <button type="button" className="btn-ghost btn-icon" onClick={onClose} aria-label="Cerrar" disabled={saving}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="finca-nombre">Nombre</label>
            <input
              id="finca-nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="ej. Finca La Loma"
              autoFocus
            />
          </div>

          <div className="field">
            <label>Capacidad del mapa</label>
            {target ? (
              <p className="muted" style={{ margin: 0 }}>
                {target.capacidad}×{target.capacidad} columnas · la capacidad no se puede cambiar luego de crear la finca.
              </p>
            ) : (
              <>
                <div className="seg" role="group" aria-label="Capacidad del mapa">
                  {CAPACIDADES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`seg-btn${capacidad === c ? ' active' : ''}`}
                      aria-pressed={capacidad === c}
                      onClick={() => setCapacidad(c)}
                    >
                      {c}×{c}
                    </button>
                  ))}
                </div>
                <p className="muted" style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--text-xs)' }}>
                  Define el ancho de la grilla de potreros. No se puede cambiar después.
                </p>
              </>
            )}
          </div>

          <div className="field">
            <label>Propiedades de la finca</label>
            <div className="meta-editor">
              {props.map((pair, i) => (
                <div className="meta-row" key={i}>
                  <input
                    className="meta-key"
                    list="finca-prop-keys"
                    value={pair.key}
                    onChange={(e) => updatePair(i, 'key', e.target.value)}
                    placeholder="Campo (ej. Ubicación)"
                    aria-label="Nombre del campo"
                  />
                  <input
                    className="meta-val"
                    value={pair.value}
                    onChange={(e) => updatePair(i, 'value', e.target.value)}
                    placeholder="Valor (ej. Vereda El Roble)"
                    aria-label="Valor del campo"
                  />
                  <button
                    type="button"
                    className="btn-ghost btn-icon"
                    onClick={() => removePair(i)}
                    aria-label="Quitar campo"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <datalist id="finca-prop-keys">
                {PROP_SUGERENCIAS.map((s) => <option key={s} value={s} />)}
              </datalist>
              <button type="button" className="btn-ghost btn-sm meta-add" onClick={addPair}>
                <Plus size={15} aria-hidden="true" />
                Agregar campo
              </button>
            </div>
          </div>

          {error && (
            <div className="error" role="alert">
              <AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
              {error}
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EmptyState({ onCrear }: { onCrear: () => void }) {
  return (
    <div className="card empty-state">
      <span className="empty-icon"><LandPlot size={28} /></span>
      <h2>Aún no tienes fincas</h2>
      <p>Crea tu primera finca para organizar tus potreros.</p>
      <button type="button" className="btn" onClick={onCrear}>
        <Plus size={16} aria-hidden="true" />
        Crear la primera
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="potrero-grid">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card" style={{ height: 168, background: 'var(--color-surface-2)' }} />
      ))}
    </div>
  );
}
