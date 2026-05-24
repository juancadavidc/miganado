import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Plus, Fence, Sprout, Beef, Clock, Pencil, Trash2, AlertCircle, X, Map, LayoutList, ArrowLeft,
  Users, UserPlus, ArrowLeftRight,
} from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { Finca, Potrero, Traslado } from '../types';
import { diasDesde, fmtDias, fmtDate } from '../lib/format';
import { useConfirm } from '../components/ConfirmDialog';
import { PotreroMapa, type GridCoords } from '../components/PotreroMapa';
import { useAuth } from '../auth/AuthContext';

type ModalState =
  | { open: false }
  | { open: true; mode: 'crear' }
  | { open: true; mode: 'editar'; target: Potrero };

type MetaPair = { key: string; value: string };

// Sugerencias de campos comunes para el datalist; las claves siguen siendo libres.
const META_SUGERENCIAS = [
  'Área',
  'Tipo de pasto',
  'Capacidad de carga',
  'Aforo',
  'Fuente de agua',
  'Topografía',
];

export function FincaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const meId = user?.id;
  const [finca, setFinca] = useState<Finca | null>(null);
  const [potreros, setPotreros] = useState<Potrero[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<'mapa' | 'lista'>('mapa');
  const { ask, dialog } = useConfirm();

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api<{ finca: Finca }>(`/api/fincas/${id}`),
      api<{ potreros: Potrero[] }>(`/api/potreros?fincaId=${id}`),
    ])
      .then(([f, p]) => {
        setFinca(f.finca);
        setPotreros(p.potreros);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else setError(err instanceof ApiError ? err.message : 'Error');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const recargarFinca = useCallback(async () => {
    if (!id) return;
    try {
      const f = await api<{ finca: Finca }>(`/api/fincas/${id}`);
      setFinca(f.finca);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    }
  }, [id]);

  function upsert(p: Potrero) {
    setPotreros((list) => {
      const idx = list.findIndex((x) => x.id === p.id);
      if (idx === -1) return [...list, p];
      const next = [...list];
      next[idx] = p;
      return next;
    });
  }

  async function toggleOcupado(p: Potrero) {
    setBusyId(p.id);
    try {
      const d = await api<{ potrero: Potrero }>(`/api/potreros/${p.id}`, {
        method: 'PUT',
        body: { ocupado: !p.ocupado },
      });
      upsert(d.potrero);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setBusyId(null);
    }
  }

  // Guarda la posición/tamaño en el mapa de forma optimista; revierte si el
  // server rechaza (solapamiento o fuera de bounds en una carrera).
  async function persistGrid(potreroId: string, coords: GridCoords) {
    const original = potreros.find((p) => p.id === potreroId);
    if (!original) return;
    upsert({ ...original, ...coords });
    try {
      const d = await api<{ potrero: Potrero }>(`/api/potreros/${potreroId}`, { method: 'PUT', body: coords });
      upsert(d.potrero);
    } catch (err) {
      upsert(original);
      setError(err instanceof ApiError ? err.message : 'Error');
    }
  }

  async function eliminar(p: Potrero) {
    const ok = await ask({
      title: `Eliminar "${p.nombre}"`,
      description: 'Se eliminará este potrero. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;
    setBusyId(p.id);
    try {
      await api(`/api/potreros/${p.id}`, { method: 'DELETE' });
      setPotreros((list) => list.filter((x) => x.id !== p.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setBusyId(null);
    }
  }

  if (notFound) {
    return (
      <div className="container">
        <div className="card empty-state">
          <span className="empty-icon"><Fence size={28} /></span>
          <h2>Finca no encontrada</h2>
          <p>La finca que buscas no existe o no es tuya.</p>
          <Link to="/fincas" className="btn">
            <ArrowLeft size={16} aria-hidden="true" />
            Volver a fincas
          </Link>
        </div>
      </div>
    );
  }

  const ocupados = potreros.filter((p) => p.ocupado).length;
  const libres = potreros.length - ocupados;

  return (
    <div className="container">
      <Link to="/fincas" className="btn-ghost btn-sm back-link">
        <ArrowLeft size={15} aria-hidden="true" />
        Fincas
      </Link>
      <header className="page-header">
        <div>
          <h1>{finca?.nombre ?? 'Potreros'}</h1>
          <p className="subtitle">
            {finca ? `Mapa de ${finca.capacidad}×${finca.capacidad} · ` : ''}
            Tus zonas de pastoreo y su estado de ocupación
          </p>
        </div>
        <button type="button" className="btn" onClick={() => setModal({ open: true, mode: 'crear' })}>
          <Plus size={16} aria-hidden="true" />
          Nuevo potrero
        </button>
      </header>

      {error && (
        <div className="error" role="alert">
          <AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
          {error}
        </div>
      )}

      {finca && (
        <SeccionPropiedadFinca finca={finca} meId={meId} onChange={recargarFinca} ask={ask} />
      )}

      {loading || !finca ? (
        <LoadingState />
      ) : potreros.length === 0 ? (
        <EmptyState onCrear={() => setModal({ open: true, mode: 'crear' })} />
      ) : (
        <>
          <section className="grid-3" style={{ marginBottom: 'var(--space-4)' }}>
            <KpiCard icon={<Fence size={16} />} label="Potreros" value={String(potreros.length)} />
            <KpiCard icon={<Beef size={16} />} label="Ocupados" value={String(ocupados)} />
            <KpiCard icon={<Sprout size={16} />} label="En descanso" value={String(libres)} />
          </section>

          <div className="tabs" role="tablist" aria-label="Vista de potreros">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'mapa'}
              className={`tab${tab === 'mapa' ? ' active' : ''}`}
              onClick={() => setTab('mapa')}
            >
              <Map size={16} aria-hidden="true" />
              Mapa
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'lista'}
              className={`tab${tab === 'lista' ? ' active' : ''}`}
              onClick={() => setTab('lista')}
            >
              <LayoutList size={16} aria-hidden="true" />
              Lista
            </button>
          </div>

          {tab === 'mapa' ? (
            <PotreroMapa
              potreros={potreros}
              cols={finca.capacidad}
              busyId={busyId}
              onPersist={persistGrid}
              onToggle={toggleOcupado}
              onEdit={(p) => setModal({ open: true, mode: 'editar', target: p })}
              onDelete={eliminar}
            />
          ) : (
          <section className="potrero-grid">
            {potreros.map((p) => {
              const dias = diasDesde(p.ocupado ? p.ocupadoDesde : p.vacioDesde);
              return (
                <article key={p.id} className={`potrero-card${p.ocupado ? ' is-ocupado' : ''}`}>
                  <div className="potrero-card-head">
                    <span className="potrero-icon" aria-hidden="true">
                      {p.ocupado ? <Beef size={18} /> : <Sprout size={18} />}
                    </span>
                    <span className={`badge ${p.ocupado ? 'is-ocupado' : 'is-libre'}`}>
                      {p.ocupado ? 'Ocupado' : 'En descanso'}
                    </span>
                  </div>

                  <h3 className="potrero-nombre">{p.nombre}</h3>

                  <div className="potrero-stat">
                    <Clock size={14} aria-hidden="true" />
                    {p.ocupado
                      ? <span>Con ganado hace <strong>{fmtDias(dias)}</strong></span>
                      : <span>Sin ganado hace <strong>{fmtDias(dias)}</strong></span>}
                  </div>
                  {!p.ocupado && p.vacioDesde && (
                    <div className="potrero-sub">Libre desde {fmtDate(p.vacioDesde)}</div>
                  )}
                  {p.ocupado && p.ocupadoDesde && (
                    <div className="potrero-sub">Ocupado desde {fmtDate(p.ocupadoDesde)}</div>
                  )}

                  {p.metadatos && Object.keys(p.metadatos).length > 0 && (
                    <dl className="potrero-meta">
                      {Object.entries(p.metadatos).map(([k, v]) => (
                        <div className="potrero-meta-item" key={k}>
                          <dt>{k}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {p.notas && <p className="potrero-notas">{p.notas}</p>}

                  <div className="potrero-actions">
                    <button
                      type="button"
                      className={p.ocupado ? 'btn-secondary btn-sm' : 'btn btn-sm'}
                      onClick={() => toggleOcupado(p)}
                      disabled={busyId === p.id}
                    >
                      {p.ocupado ? 'Liberar' : 'Marcar ocupado'}
                    </button>
                    <div className="nav-spacer" />
                    <button
                      type="button"
                      className="btn-ghost btn-icon"
                      onClick={() => setModal({ open: true, mode: 'editar', target: p })}
                      aria-label={`Editar ${p.nombre}`}
                      disabled={busyId === p.id}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-icon"
                      onClick={() => eliminar(p)}
                      aria-label={`Eliminar ${p.nombre}`}
                      disabled={busyId === p.id}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
          )}
        </>
      )}

      {modal.open && finca && (
        <PotreroModal
          fincaId={finca.id}
          target={modal.mode === 'editar' ? modal.target : null}
          onClose={() => setModal({ open: false })}
          onSaved={(p) => { upsert(p); setModal({ open: false }); }}
        />
      )}
      {dialog}
    </div>
  );
}

type Asker = ReturnType<typeof useConfirm>['ask'];

function Persona({ rol, persona, meId, nota }: {
  rol: string;
  persona?: { id: string; nombre: string; documento: string } | null;
  meId?: string;
  nota?: string;
}) {
  return (
    <div>
      <div className="label-cap">{rol}</div>
      {persona ? (
        <>
          <div style={{ fontWeight: 600 }}>
            {persona.nombre}
            {persona.id === meId && <span className="muted" style={{ fontWeight: 400 }}> (vos)</span>}
          </div>
          <div className="muted" style={{ fontSize: '0.8rem' }}>Doc. {persona.documento}{nota ? ` · ${nota}` : ''}</div>
        </>
      ) : (
        <div className="muted">— sin asignar —</div>
      )}
    </div>
  );
}

function SeccionPropiedadFinca({ finca, meId, onChange, ask }: {
  finca: Finca; meId?: string; onChange: () => void; ask: Asker;
}) {
  const [accion, setAccion] = useState<'cuidador' | 'dueno' | null>(null);
  const [documento, setDocumento] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const esDueno = finca.dueno?.id === meId;
  const traslados = finca.traslados ?? [];
  const pendienteCuidador = traslados.find((t) => t.rol === 'CUIDADOR' && t.estado === 'PENDIENTE');
  const pendienteDueno = traslados.find((t) => t.rol === 'DUENO' && t.estado === 'PENDIENTE');
  const cuidadorEsDueno = !!finca.cuidador && finca.cuidador.id === finca.dueno?.id;

  function reset() { setAccion(null); setDocumento(''); setMensaje(''); setError(null); }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!accion) return;
    setLoading(true);
    setError(null);
    try {
      const path = accion === 'cuidador' ? `/api/fincas/${finca.id}/cuidador` : `/api/fincas/${finca.id}/dueno`;
      await api(path, { method: 'POST', body: { documento: documento.trim(), mensaje: mensaje.trim() || null } });
      reset();
      onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function quitarCuidador() {
    const ok = await ask({
      title: '¿Quitar al cuidador?',
      description: 'La finca quedará sin cuidador asignado. Podés volver a asignar uno cuando quieras.',
      confirmLabel: 'Quitar',
      variant: 'danger',
    });
    if (!ok) return;
    setError(null);
    try {
      await api(`/api/fincas/${finca.id}/cuidador`, { method: 'DELETE' });
      onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    }
  }

  async function cancelar(t: Traslado) {
    setError(null);
    try {
      await api(`/api/traslados/${t.id}/cancelar`, { method: 'POST' });
      onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    }
  }

  return (
    <section className="card" style={{ marginBottom: 'var(--space-4)' }}>
      <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
        <h2 className="row" style={{ gap: 'var(--space-2)' }}>
          <Users size={18} aria-hidden="true" />
          Propiedad y cuidado
        </h2>
      </div>

      <div className="grid-3" style={{ gap: 'var(--space-3)' }}>
        <Persona rol="Dueño" persona={finca.dueno} meId={meId} />
        <Persona
          rol="Cuidador"
          persona={finca.cuidador}
          meId={meId}
          nota={cuidadorEsDueno ? 'el mismo dueño' : undefined}
        />
      </div>

      {pendienteCuidador && (
        <div className="callout warn row-between" style={{ marginTop: 'var(--space-3)' }}>
          <span className="row" style={{ gap: 'var(--space-2)' }}>
            <Clock size={14} aria-hidden="true" />
            Cuidador pendiente: <strong>{pendienteCuidador.para?.nombre}</strong> — esperando que acepte.
          </span>
          {esDueno && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => cancelar(pendienteCuidador)}>
              Cancelar
            </button>
          )}
        </div>
      )}

      {pendienteDueno && (
        <div className="callout warn row-between" style={{ marginTop: 'var(--space-3)' }}>
          <span className="row" style={{ gap: 'var(--space-2)' }}>
            <Clock size={14} aria-hidden="true" />
            Traspaso de propiedad pendiente: a <strong>{pendienteDueno.para?.nombre}</strong> — esperando que acepte.
          </span>
          {esDueno && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => cancelar(pendienteDueno)}>
              Cancelar
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="error" role="alert" style={{ marginTop: 'var(--space-3)' }}>
          <AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} /> {error}
        </div>
      )}

      {esDueno ? (
        <>
          <div className="row" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={accion === 'cuidador' ? 'btn-secondary' : ''}
              onClick={() => { setAccion((a) => (a === 'cuidador' ? null : 'cuidador')); setError(null); }}
            >
              <UserPlus size={16} aria-hidden="true" />
              {finca.cuidador ? 'Cambiar cuidador' : 'Asignar cuidador'}
            </button>
            {finca.cuidador && !cuidadorEsDueno && (
              <button type="button" className="btn-secondary" onClick={quitarCuidador}>
                Quitar cuidador
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { setAccion((a) => (a === 'dueno' ? null : 'dueno')); setError(null); }}
            >
              <ArrowLeftRight size={16} aria-hidden="true" />
              Transferir propiedad
            </button>
          </div>

          {accion && (
            <form
              onSubmit={enviar}
              style={{
                background: 'var(--color-surface-2)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-lg)',
                marginTop: 'var(--space-3)',
              }}
            >
              <div className="field">
                <label htmlFor="finca-prop-doc">
                  Documento {accion === 'cuidador' ? 'del cuidador' : 'del nuevo dueño'}
                </label>
                <input
                  id="finca-prop-doc"
                  type="text"
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  required
                  placeholder="ej. 1234"
                />
              </div>
              <div className="field">
                <label htmlFor="finca-prop-msg">Mensaje (opcional)</label>
                <input
                  id="finca-prop-msg"
                  type="text"
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  placeholder="ej. Te dejo la finca a cargo"
                />
              </div>
              <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 var(--space-2)' }}>
                {accion === 'cuidador'
                  ? 'El cuidador deberá aceptar la asignación para tomar el control de la finca y sus lotes.'
                  : 'El nuevo dueño deberá aceptar para recibir la finca. Hasta entonces seguís siendo el dueño.'}
              </p>
              <div className="row" style={{ justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                <button type="button" className="btn-secondary" onClick={reset}>Cancelar</button>
                <button type="submit" disabled={loading}>
                  {loading ? 'Enviando…' : accion === 'cuidador' ? 'Enviar asignación' : 'Enviar traspaso'}
                </button>
              </div>
            </form>
          )}
        </>
      ) : (
        <p className="muted" style={{ marginTop: 'var(--space-3)' }}>
          Cuidás esta finca. Podés registrar el día a día (potreros, lotes, pesos, gastos, anotaciones).
          Los valores comerciales y la asignación de roles los maneja el dueño.
        </p>
      )}
    </section>
  );
}

function PotreroModal({
  fincaId,
  target,
  onClose,
  onSaved,
}: {
  fincaId: string;
  target: Potrero | null;
  onClose: () => void;
  onSaved: (p: Potrero) => void;
}) {
  const [nombre, setNombre] = useState(target?.nombre ?? '');
  const [notas, setNotas] = useState(target?.notas ?? '');
  const [meta, setMeta] = useState<MetaPair[]>(() => {
    const m = target?.metadatos;
    return m && Object.keys(m).length > 0
      ? Object.entries(m).map(([key, value]) => ({ key, value }))
      : [];
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updatePair(i: number, field: keyof MetaPair, val: string) {
    setMeta((rows) => rows.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));
  }
  function addPair() {
    setMeta((rows) => [...rows, { key: '', value: '' }]);
  }
  function removePair(i: number) {
    setMeta((rows) => rows.filter((_, idx) => idx !== i));
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
      const metadatos: Record<string, string> = {};
      for (const { key, value } of meta) {
        const k = key.trim();
        const v = value.trim();
        if (k && v) metadatos[k] = v;
      }
      const metaPayload = Object.keys(metadatos).length > 0 ? metadatos : null;
      const d = target
        ? await api<{ potrero: Potrero }>(`/api/potreros/${target.id}`, {
            method: 'PUT',
            body: { nombre: nombre.trim(), notas: notas.trim() || null, metadatos: metaPayload },
          })
        : await api<{ potrero: Potrero }>('/api/potreros', {
            method: 'POST',
            body: { fincaId, nombre: nombre.trim(), notas: notas.trim() || null, metadatos: metaPayload },
          });
      onSaved(d.potrero);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
      setSaving(false);
    }
  }

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="potrero-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="modal">
        <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
          <h2 id="potrero-modal-title" style={{ margin: 0 }}>
            {target ? 'Editar potrero' : 'Nuevo potrero'}
          </h2>
          <button type="button" className="btn-ghost btn-icon" onClick={onClose} aria-label="Cerrar" disabled={saving}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="potrero-nombre">Nombre</label>
            <input
              id="potrero-nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="ej. Potrero La Loma"
              autoFocus
            />
          </div>
          <div className="field">
            <label>Datos del potrero</label>
            <div className="meta-editor">
              {meta.map((pair, i) => (
                <div className="meta-row" key={i}>
                  <input
                    className="meta-key"
                    list="potrero-meta-keys"
                    value={pair.key}
                    onChange={(e) => updatePair(i, 'key', e.target.value)}
                    placeholder="Campo (ej. Área)"
                    aria-label="Nombre del campo"
                  />
                  <input
                    className="meta-val"
                    value={pair.value}
                    onChange={(e) => updatePair(i, 'value', e.target.value)}
                    placeholder="Valor (ej. 3 ha)"
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
              <datalist id="potrero-meta-keys">
                {META_SUGERENCIAS.map((s) => <option key={s} value={s} />)}
              </datalist>
              <button type="button" className="btn-ghost btn-sm meta-add" onClick={addPair}>
                <Plus size={15} aria-hidden="true" />
                Agregar campo
              </button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="potrero-notas">Notas</label>
            <textarea
              id="potrero-notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              placeholder="Observaciones libres…"
            />
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

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card kpi">
      <div className="kpi-head">
        <span>{label}</span>
        <span className="ico">{icon}</span>
      </div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

function EmptyState({ onCrear }: { onCrear: () => void }) {
  return (
    <div className="card empty-state">
      <span className="empty-icon"><Fence size={28} /></span>
      <h2>Aún no tienes potreros</h2>
      <p>Crea tu primer potrero para empezar a mapear tu zona de pastoreo.</p>
      <button type="button" className="btn" onClick={onCrear}>
        <Plus size={16} aria-hidden="true" />
        Crear el primero
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
