import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Beef, MapPin, MapPinOff, Scissors, ArrowRightLeft, Merge,
  Pencil, Trash2, AlertCircle, X, Layers, ChevronRight,
} from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { Finca, Grupo, Potrero, Sexo } from '../types';
import { SEXO_LABELS } from '../types';
import { diasDesde, fmtDias } from '../lib/format';
import { SexoBadge } from '../components/SexoBadge';
import { useConfirm } from '../components/ConfirmDialog';

const SEXOS: Sexo[] = ['VP', 'HV', 'HL', 'ML', 'MC', 'TO'];

type ModalState =
  | { open: false }
  | { open: true; mode: 'crear' }
  | { open: true; mode: 'editar'; target: Grupo }
  | { open: true; mode: 'mover'; target: Grupo }
  | { open: true; mode: 'dividir'; target: Grupo }
  | { open: true; mode: 'fusionar'; target: Grupo };

export function GruposPage() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [fincas, setFincas] = useState<Finca[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ open: false });
  const { ask, dialog } = useConfirm();

  useEffect(() => {
    Promise.all([
      api<{ grupos: Grupo[] }>('/api/grupos'),
      api<{ fincas: Finca[] }>('/api/fincas'),
    ])
      .then(([g, f]) => {
        setGrupos(g.grupos);
        setFincas(f.fincas);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error'))
      .finally(() => setLoading(false));
  }, []);

  async function recargar() {
    const d = await api<{ grupos: Grupo[] }>('/api/grupos');
    setGrupos(d.grupos);
  }

  async function eliminar(g: Grupo) {
    const ok = await ask({
      title: `Eliminar "${g.nombre}"`,
      description: `Se eliminará este grupo de ${g.cantidad} ${g.cantidad === 1 ? 'cabeza' : 'cabezas'}. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;
    setBusyId(g.id);
    try {
      await api(`/api/grupos/${g.id}`, { method: 'DELETE' });
      await recargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setBusyId(null);
    }
  }

  async function sacar(g: Grupo) {
    setBusyId(g.id);
    try {
      await api(`/api/grupos/${g.id}/mover`, { method: 'POST', body: { potreroId: null } });
      await recargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setBusyId(null);
    }
  }

  const sinUbicar = grupos.filter((g) => !g.potreroId);
  const ubicados = grupos.filter((g) => g.potreroId);
  const totalCabezas = grupos.reduce((s, g) => s + g.cantidad, 0);
  const cabezasSinUbicar = sinUbicar.reduce((s, g) => s + g.cantidad, 0);

  function onSaved() {
    setModal({ open: false });
    recargar();
  }

  return (
    <div className="container">
      <header className="page-header">
        <div>
          <h1>Ganado</h1>
          <p className="subtitle">Grupos de ganado y en qué potrero está cada uno</p>
        </div>
        <button type="button" className="btn" onClick={() => setModal({ open: true, mode: 'crear' })}>
          <Plus size={16} aria-hidden="true" />
          Nuevo grupo
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
      ) : grupos.length === 0 ? (
        <EmptyState onCrear={() => setModal({ open: true, mode: 'crear' })} />
      ) : (
        <>
          <section className="grid-3" style={{ marginBottom: 'var(--space-4)' }}>
            <KpiCard icon={<Layers size={16} />} label="Grupos" value={String(grupos.length)} />
            <KpiCard icon={<Beef size={16} />} label="Cabezas en total" value={String(totalCabezas)} />
            <KpiCard icon={<MapPinOff size={16} />} label="Cabezas sin ubicar" value={String(cabezasSinUbicar)} />
          </section>

          {sinUbicar.length > 0 && (
            <section style={{ marginBottom: 'var(--space-4)' }}>
              <h2 className="row" style={{ gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                <MapPinOff size={18} aria-hidden="true" />
                Sin ubicar
                <span className="muted tabnum">({sinUbicar.length})</span>
              </h2>
              <div className="potrero-grid">
                {sinUbicar.map((g) => (
                  <GrupoCard
                    key={g.id}
                    grupo={g}
                    busy={busyId === g.id}
                    onMover={() => setModal({ open: true, mode: 'mover', target: g })}
                    onDividir={() => setModal({ open: true, mode: 'dividir', target: g })}
                    onFusionar={() => setModal({ open: true, mode: 'fusionar', target: g })}
                    onEditar={() => setModal({ open: true, mode: 'editar', target: g })}
                    onEliminar={() => eliminar(g)}
                    canFusionar={grupos.some((o) => o.id !== g.id && o.sexo === g.sexo && !o.potreroId)}
                  />
                ))}
              </div>
            </section>
          )}

          {ubicados.length > 0 && (
            <section>
              <h2 className="row" style={{ gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                <MapPin size={18} aria-hidden="true" />
                En potreros
                <span className="muted tabnum">({ubicados.length})</span>
              </h2>
              <div className="potrero-grid">
                {ubicados.map((g) => (
                  <GrupoCard
                    key={g.id}
                    grupo={g}
                    busy={busyId === g.id}
                    onMover={() => setModal({ open: true, mode: 'mover', target: g })}
                    onDividir={() => setModal({ open: true, mode: 'dividir', target: g })}
                    onFusionar={() => setModal({ open: true, mode: 'fusionar', target: g })}
                    onSacar={() => sacar(g)}
                    onEditar={() => setModal({ open: true, mode: 'editar', target: g })}
                    onEliminar={() => eliminar(g)}
                    canFusionar={grupos.some(
                      (o) => o.id !== g.id && o.sexo === g.sexo && o.potreroId === g.potreroId,
                    )}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {modal.open && (modal.mode === 'crear' || modal.mode === 'editar') && (
        <GrupoFormModal
          target={modal.mode === 'editar' ? modal.target : null}
          onClose={() => setModal({ open: false })}
          onSaved={onSaved}
        />
      )}
      {modal.open && modal.mode === 'mover' && (
        <MoverModal grupo={modal.target} fincas={fincas} onClose={() => setModal({ open: false })} onSaved={onSaved} />
      )}
      {modal.open && modal.mode === 'dividir' && (
        <DividirModal grupo={modal.target} fincas={fincas} onClose={() => setModal({ open: false })} onSaved={onSaved} />
      )}
      {modal.open && modal.mode === 'fusionar' && (
        <FusionarModal
          grupo={modal.target}
          candidatos={grupos.filter(
            (o) => o.id !== modal.target.id && o.sexo === modal.target.sexo && o.potreroId === modal.target.potreroId,
          )}
          onClose={() => setModal({ open: false })}
          onSaved={onSaved}
        />
      )}
      {dialog}
    </div>
  );
}

function GrupoCard({
  grupo, busy, onMover, onDividir, onFusionar, onSacar, onEditar, onEliminar, canFusionar,
}: {
  grupo: Grupo;
  busy: boolean;
  onMover: () => void;
  onDividir: () => void;
  onFusionar: () => void;
  onSacar?: () => void;
  onEditar: () => void;
  onEliminar: () => void;
  canFusionar: boolean;
}) {
  const dias = diasDesde(grupo.ingresoPotrero);
  return (
    <article className={`potrero-card${grupo.potreroId ? ' is-ocupado' : ''}`}>
      <div className="potrero-card-head">
        <span className="potrero-icon" aria-hidden="true"><Beef size={18} /></span>
        <SexoBadge sexo={grupo.sexo} />
      </div>

      <h3 className="potrero-nombre">{grupo.nombre}</h3>

      <div className="potrero-stat">
        <Beef size={14} aria-hidden="true" />
        <span><strong>{grupo.cantidad}</strong> {grupo.cantidad === 1 ? 'cabeza' : 'cabezas'}</span>
      </div>

      {grupo.potrero ? (
        <div className="potrero-stat">
          <MapPin size={14} aria-hidden="true" />
          <span>
            <Link to={`/fincas/${grupo.potrero.fincaId}`}>{grupo.potrero.finca.nombre}</Link>
            {' · '}<strong>{grupo.potrero.nombre}</strong>
          </span>
        </div>
      ) : (
        <div className="potrero-stat muted">
          <MapPinOff size={14} aria-hidden="true" />
          <span>Sin ubicar</span>
        </div>
      )}

      {grupo.potreroId && (
        <div className="potrero-sub">En este potrero hace {fmtDias(dias)}</div>
      )}
      {grupo.lote && (
        <div className="potrero-sub">
          Lote {grupo.lote.loteNumero ?? '—'}{grupo.lote.numeroFeria ? ` · Feria ${grupo.lote.numeroFeria}` : ''}
        </div>
      )}
      {grupo.notas && <p className="potrero-notas">{grupo.notas}</p>}

      <div className="potrero-actions">
        <button type="button" className="btn btn-sm" onClick={onMover} disabled={busy}>
          <ArrowRightLeft size={14} aria-hidden="true" />
          Mover
        </button>
        {onSacar && (
          <button type="button" className="btn-secondary btn-sm" onClick={onSacar} disabled={busy}>
            Sacar
          </button>
        )}
        <div className="nav-spacer" />
        <button
          type="button"
          className="btn-ghost btn-icon"
          onClick={onDividir}
          aria-label="Dividir grupo"
          title="Dividir"
          disabled={busy || grupo.cantidad < 2}
        >
          <Scissors size={16} />
        </button>
        <button
          type="button"
          className="btn-ghost btn-icon"
          onClick={onFusionar}
          aria-label="Fusionar grupo"
          title={canFusionar ? 'Fusionar con otro grupo' : 'No hay grupos compatibles para fusionar'}
          disabled={busy || !canFusionar}
        >
          <Merge size={16} />
        </button>
        <button type="button" className="btn-ghost btn-icon" onClick={onEditar} aria-label="Editar grupo" disabled={busy}>
          <Pencil size={16} />
        </button>
        <button type="button" className="btn-ghost btn-icon" onClick={onEliminar} aria-label="Eliminar grupo" disabled={busy}>
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}

// Selector de destino reutilizable: finca → potrero. Devuelve potreroId | null
// (null = sin ubicar). Carga los potreros de la finca elegida bajo demanda.
function PotreroPicker({
  fincas, value, onChange, allowSinUbicar = true,
}: {
  fincas: Finca[];
  value: string | null;
  onChange: (potreroId: string | null) => void;
  allowSinUbicar?: boolean;
}) {
  const [fincaId, setFincaId] = useState<string>('');
  const [potreros, setPotreros] = useState<Potrero[]>([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!fincaId) { setPotreros([]); return; }
    setCargando(true);
    api<{ potreros: Potrero[] }>(`/api/potreros?fincaId=${fincaId}`)
      .then((d) => setPotreros(d.potreros))
      .catch(() => setPotreros([]))
      .finally(() => setCargando(false));
  }, [fincaId]);

  return (
    <>
      <div className="field">
        <label htmlFor="picker-finca">Finca</label>
        <select
          id="picker-finca"
          value={fincaId}
          onChange={(e) => { setFincaId(e.target.value); onChange(null); }}
        >
          <option value="">— elegir finca —</option>
          {fincas.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
        </select>
      </div>
      {fincaId && (
        <div className="field">
          <label htmlFor="picker-potrero">Potrero</label>
          <select
            id="picker-potrero"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={cargando}
          >
            <option value="">{allowSinUbicar ? '— sin ubicar —' : '— elegir potrero —'}</option>
            {potreros.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}{p.ocupado ? ' (ocupado)' : ''}</option>
            ))}
          </select>
          {!cargando && potreros.length === 0 && (
            <p className="muted" style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--text-xs)' }}>
              Esta finca aún no tiene potreros.
            </p>
          )}
        </div>
      )}
    </>
  );
}

function ModalShell({
  title, onClose, saving, children,
}: {
  title: string;
  onClose: () => void;
  saving: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && !saving) onClose(); }
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [saving, onClose]);

  return (
    <div className="scrim" role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="modal">
        <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button type="button" className="btn-ghost btn-icon" onClick={onClose} aria-label="Cerrar" disabled={saving}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function GrupoFormModal({
  target, onClose, onSaved,
}: {
  target: Grupo | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState(target?.nombre ?? '');
  const [sexo, setSexo] = useState<Sexo>(target?.sexo ?? 'MC');
  const [cantidad, setCantidad] = useState<number>(target?.cantidad ?? 1);
  const [notas, setNotas] = useState(target?.notas ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return; }
    if (cantidad < 1) { setError('La cantidad debe ser al menos 1'); return; }
    setError(null);
    setSaving(true);
    try {
      const body = { nombre: nombre.trim(), sexo, cantidad, notas: notas.trim() || null };
      if (target) {
        await api(`/api/grupos/${target.id}`, { method: 'PUT', body });
      } else {
        await api('/api/grupos', { method: 'POST', body });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
      setSaving(false);
    }
  }

  return (
    <ModalShell title={target ? 'Editar grupo' : 'Nuevo grupo'} onClose={onClose} saving={saving}>
      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="grupo-nombre">Nombre</label>
          <input id="grupo-nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
            placeholder="ej. Machos de ceba" autoFocus />
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="grupo-sexo">Sexo</label>
            <select id="grupo-sexo" value={sexo} onChange={(e) => setSexo(e.target.value as Sexo)}>
              {SEXOS.map((s) => <option key={s} value={s}>{SEXO_LABELS[s]}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="grupo-cantidad">Cabezas</label>
            <input id="grupo-cantidad" type="number" min={1} value={cantidad}
              onChange={(e) => setCantidad(Math.max(1, Number(e.target.value) || 1))} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="grupo-notas">Notas</label>
          <textarea id="grupo-notas" value={notas} onChange={(e) => setNotas(e.target.value)} rows={3}
            placeholder="Observaciones libres…" />
        </div>
        {error && <div className="error" role="alert"><AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function MoverModal({
  grupo, fincas, onClose, onSaved,
}: {
  grupo: Grupo;
  fincas: Finca[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [potreroId, setPotreroId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!potreroId) { setError('Elige el potrero de destino'); return; }
    setError(null);
    setSaving(true);
    try {
      await api(`/api/grupos/${grupo.id}/mover`, { method: 'POST', body: { potreroId } });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
      setSaving(false);
    }
  }

  return (
    <ModalShell title={`Mover "${grupo.nombre}"`} onClose={onClose} saving={saving}>
      <form onSubmit={onSubmit}>
        <p className="muted" style={{ marginTop: 0 }}>
          {grupo.cantidad} {grupo.cantidad === 1 ? 'cabeza' : 'cabezas'} · <SexoBadge sexo={grupo.sexo} />
          {grupo.potrero && <> · ahora en <strong>{grupo.potrero.nombre}</strong></>}
        </p>
        {fincas.length === 0 ? (
          <div className="callout warn">Primero crea una finca con potreros para poder ubicar el ganado.</div>
        ) : (
          <PotreroPicker fincas={fincas} value={potreroId} onChange={setPotreroId} allowSinUbicar={false} />
        )}
        {error && <div className="error" role="alert"><AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" disabled={saving || fincas.length === 0}>{saving ? 'Moviendo…' : 'Mover aquí'}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function DividirModal({
  grupo, fincas, onClose, onSaved,
}: {
  grupo: Grupo;
  fincas: Finca[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [cantidad, setCantidad] = useState<number>(1);
  const [destino, setDestino] = useState<'mismo' | 'otro' | 'sinUbicar'>(grupo.potreroId ? 'mismo' : 'sinUbicar');
  const [potreroId, setPotreroId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const max = grupo.cantidad - 1;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (cantidad < 1 || cantidad > max) { setError(`Debes separar entre 1 y ${max} cabezas`); return; }
    let body: { cantidad: number; potreroId?: string | null };
    if (destino === 'mismo') body = { cantidad }; // hereda el potrero del original
    else if (destino === 'sinUbicar') body = { cantidad, potreroId: null };
    else {
      if (!potreroId) { setError('Elige el potrero de destino'); return; }
      body = { cantidad, potreroId };
    }
    setError(null);
    setSaving(true);
    try {
      await api(`/api/grupos/${grupo.id}/dividir`, { method: 'POST', body });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
      setSaving(false);
    }
  }

  return (
    <ModalShell title={`Dividir "${grupo.nombre}"`} onClose={onClose} saving={saving}>
      <form onSubmit={onSubmit}>
        <p className="muted" style={{ marginTop: 0 }}>
          El grupo tiene {grupo.cantidad} cabezas. Separa una parte en un grupo nuevo (por ejemplo para apartar por sexo o peso).
        </p>
        <div className="field">
          <label htmlFor="dividir-cant">Cabezas a separar</label>
          <input id="dividir-cant" type="number" min={1} max={max} value={cantidad}
            onChange={(e) => setCantidad(Math.max(1, Math.min(max, Number(e.target.value) || 1)))} autoFocus />
          <p className="muted" style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--text-xs)' }}>
            Quedarán {Math.max(0, grupo.cantidad - cantidad)} en el grupo original.
          </p>
        </div>
        <div className="field">
          <label htmlFor="dividir-destino">Destino del grupo nuevo</label>
          <select id="dividir-destino" value={destino} onChange={(e) => setDestino(e.target.value as typeof destino)}>
            {grupo.potreroId && <option value="mismo">Quedarse en {grupo.potrero?.nombre ?? 'el mismo potrero'}</option>}
            <option value="otro">Mandar a otro potrero</option>
            <option value="sinUbicar">Dejar sin ubicar</option>
          </select>
        </div>
        {destino === 'otro' && (
          fincas.length === 0
            ? <div className="callout warn">No tienes fincas con potreros todavía.</div>
            : <PotreroPicker fincas={fincas} value={potreroId} onChange={setPotreroId} allowSinUbicar={false} />
        )}
        {error && <div className="error" role="alert"><AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" disabled={saving}>{saving ? 'Dividiendo…' : 'Dividir'}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function FusionarModal({
  grupo, candidatos, onClose, onSaved,
}: {
  grupo: Grupo;
  candidatos: Grupo[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [otroGrupoId, setOtroGrupoId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ubicacion = grupo.potrero ? grupo.potrero.nombre : 'sin ubicar';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!otroGrupoId) { setError('Elige el grupo a fusionar'); return; }
    setError(null);
    setSaving(true);
    try {
      await api(`/api/grupos/${grupo.id}/fusionar`, { method: 'POST', body: { otroGrupoId } });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
      setSaving(false);
    }
  }

  return (
    <ModalShell title={`Fusionar con "${grupo.nombre}"`} onClose={onClose} saving={saving}>
      <form onSubmit={onSubmit}>
        <p className="muted" style={{ marginTop: 0 }}>
          Solo se pueden fusionar grupos del mismo sexo (<SexoBadge sexo={grupo.sexo} />) y en la misma ubicación ({ubicacion}).
          El otro grupo se sumará a este.
        </p>
        <div className="field">
          <label htmlFor="fusionar-otro">Grupo a sumar</label>
          <select id="fusionar-otro" value={otroGrupoId} onChange={(e) => setOtroGrupoId(e.target.value)} autoFocus>
            <option value="">— elegir grupo —</option>
            {candidatos.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre} ({c.cantidad} cab.)</option>
            ))}
          </select>
        </div>
        {error && <div className="error" role="alert"><AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" disabled={saving}>{saving ? 'Fusionando…' : 'Fusionar'}</button>
        </div>
      </form>
    </ModalShell>
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
      <span className="empty-icon"><Beef size={28} /></span>
      <h2>Aún no tienes grupos de ganado</h2>
      <p>Al registrar un lote (manual o desde la planilla de feria) se crea su grupo automáticamente. También puedes crear uno aquí.</p>
      <div className="row" style={{ gap: 'var(--space-2)' }}>
        <button type="button" className="btn" onClick={onCrear}>
          <Plus size={16} aria-hidden="true" />
          Crear grupo
        </button>
        <Link to="/lotes/importar" className="btn-secondary">
          Importar planilla
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="potrero-grid">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card" style={{ height: 200, background: 'var(--color-surface-2)' }} />
      ))}
    </div>
  );
}
