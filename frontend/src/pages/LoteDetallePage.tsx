import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Trash2, Plus, X, Upload, Camera, ImageOff,
  AlertCircle, Receipt, ListOrdered, Calendar, MessageSquare,
} from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { Animal, CriaSexo, Foto, Gasto, LoteDetalle, Sexo } from '../types';
import { CRIA_SEXO_LABELS, SEXO_LABELS } from '../types';
import { fmtDate, fmtMoney, fmtNum } from '../lib/format';
import { SexoBadge } from '../components/SexoBadge';
import { useConfirm } from '../components/ConfirmDialog';
import { Anotaciones } from '../components/Anotaciones';

const SEXOS: Sexo[] = ['VP', 'HV', 'HL', 'ML', 'MC', 'TO'];

export function LoteDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lote, setLote] = useState<LoteDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { ask, dialog } = useConfirm();

  const cargar = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api<{ lote: LoteDetalle }>(`/api/lotes/${id}`);
      setLote(data.lote);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  async function onDelete() {
    if (!lote) return;
    const ok = await ask({
      title: '¿Eliminar este lote?',
      description: 'Se borrarán también sus animales, fotos y gastos. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api(`/api/lotes/${lote.id}`, { method: 'DELETE' });
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    }
  }

  if (loading) return <div className="container"><p className="muted">Cargando…</p></div>;
  if (error) return (
    <div className="container">
      <div className="error" role="alert">
        <AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} /> {error}
      </div>
    </div>
  );
  if (!lote) return <div className="container">Lote no encontrado</div>;

  const gastosTotal = lote.gastos.reduce((s, g) => s + Number(g.monto), 0);
  const utilidad = Number(lote.valorAPagar) - gastosTotal;

  return (
    <div className="container">
      <header className="page-header">
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <button type="button" className="btn-ghost btn-icon" onClick={() => navigate('/')} aria-label="Volver al dashboard">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>Lote {lote.loteNumero ?? '—'}</h1>
            <p className="subtitle row" style={{ gap: 'var(--space-2)' }}>
              <Calendar size={13} aria-hidden="true" />
              {fmtDate(lote.fecha)}
              <span aria-hidden="true">·</span>
              Feria {lote.numeroFeria ?? '—'}
              <span aria-hidden="true">·</span>
              <SexoBadge sexo={lote.sexo} />
              <span aria-hidden="true">·</span>
              {lote.cantidad} {lote.cantidad === 1 ? 'cabeza' : 'cabezas'}
              {lote.referencia && (<><span aria-hidden="true">·</span>Ref. {lote.referencia}</>)}
            </p>
          </div>
        </div>
        <button className="btn-danger" onClick={onDelete}>
          <Trash2 size={16} aria-hidden="true" />
          Eliminar lote
        </button>
      </header>

      {lote.sexo === 'VP' && (lote.criasMacho > 0 || lote.criasHembra > 0) && (
        <div className="callout warn" style={{ marginBottom: 'var(--space-4)' }}>
          Vienen acompañadas de <strong>{lote.criasMacho}</strong> {lote.criasMacho === 1 ? 'cría macho' : 'crías macho'}
          {' y '}
          <strong>{lote.criasHembra}</strong> {lote.criasHembra === 1 ? 'cría hembra' : 'crías hembra'}.
        </div>
      )}

      <section className="grid-3" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="card">
          <div className="label-cap">Peso</div>
          <div className="kpi-value">{fmtNum(lote.pesoTotal)} kg</div>
          <div className="kpi-sub">Promedio: {fmtNum(lote.pesoPromedio)} kg / cabeza</div>
        </div>
        <div className="card">
          <div className="label-cap">Valor total</div>
          <div className="kpi-value">{fmtMoney(lote.valorTotal)}</div>
          <div className="kpi-sub">Deducción: −{fmtMoney(lote.deduccion)}</div>
        </div>
        <div className="card">
          <div className="label-cap">A pagar / Utilidad</div>
          <div className="kpi-value" style={{ color: 'var(--color-primary)' }}>{fmtMoney(lote.valorAPagar)}</div>
          <div className="kpi-sub">Utilidad (− gastos): <strong className="tabnum">{fmtMoney(utilidad)}</strong></div>
        </div>
      </section>

      <SeccionFotos lote={lote} onChange={cargar} ask={ask} />
      <SeccionAnotacionesLote lote={lote} onChange={cargar} />
      <SeccionAnimales lote={lote} onChange={cargar} ask={ask} />
      <SeccionGastos lote={lote} onChange={cargar} ask={ask} />

      {dialog}
    </div>
  );
}

type Asker = ReturnType<typeof useConfirm>['ask'];

function SeccionAnotacionesLote({ lote, onChange }: { lote: LoteDetalle; onChange: () => void }) {
  return (
    <section className="card" style={{ marginBottom: 'var(--space-4)' }}>
      <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
        <h2 className="row" style={{ gap: 'var(--space-2)' }}>
          <MessageSquare size={18} aria-hidden="true" />
          Anotaciones del lote
          <span className="muted tabnum">({lote.anotaciones.length})</span>
        </h2>
      </div>
      <Anotaciones
        target={{ loteId: lote.id }}
        anotaciones={lote.anotaciones}
        onChange={onChange}
      />
    </section>
  );
}

function SeccionFotos({ lote, onChange, ask }: { lote: LoteDetalle; onChange: () => void; ask: Asker }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('foto', file);
      fd.append('loteId', lote.id);
      await api('/api/fotos', { method: 'POST', body: fd });
      onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error subiendo foto');
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(foto: Foto) {
    const ok = await ask({
      title: '¿Eliminar foto?',
      description: 'No se podrá recuperar.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api(`/api/fotos/${foto.id}`, { method: 'DELETE' });
      onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    }
  }

  return (
    <section className="card" style={{ marginBottom: 'var(--space-4)' }}>
      <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
        <h2 className="row" style={{ gap: 'var(--space-2)' }}>
          <Camera size={18} aria-hidden="true" />
          Fotos del lote
          <span className="muted tabnum">({lote.fotos.length})</span>
        </h2>
        <label className="btn">
          <Upload size={16} aria-hidden="true" />
          {uploading ? 'Subiendo…' : 'Subir foto'}
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            disabled={uploading}
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>
      </div>
      {error && (
        <div className="error" role="alert">
          <AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} /> {error}
        </div>
      )}
      {lote.fotos.length === 0 ? (
        <div className="muted row" style={{ gap: 'var(--space-2)' }}>
          <ImageOff size={16} aria-hidden="true" /> Sin fotos
        </div>
      ) : (
        <div className="photo-grid">
          {lote.fotos.map((f) => (
            <div key={f.id} className="photo">
              <a href={`/uploads/${f.filename}`} target="_blank" rel="noreferrer">
                <img src={`/uploads/${f.filename}`} alt={`Foto del lote ${lote.loteNumero ?? ''}`} loading="lazy" />
              </a>
              <button
                type="button"
                className="btn-icon photo-del"
                onClick={() => onDelete(f)}
                aria-label="Eliminar foto"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SeccionAnimales({ lote, onChange, ask }: { lote: LoteDetalle; onChange: () => void; ask: Asker }) {
  const [showForm, setShowForm] = useState(false);
  return (
    <section className="card" style={{ marginBottom: 'var(--space-4)' }}>
      <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
        <h2 className="row" style={{ gap: 'var(--space-2)' }}>
          <ListOrdered size={18} aria-hidden="true" />
          Animales individuales
          <span className="muted tabnum">({lote.animales.length})</span>
        </h2>
        <button className={showForm ? 'btn-secondary' : ''} onClick={() => setShowForm((s) => !s)}>
          {showForm ? <><X size={16} aria-hidden="true" />Cancelar</> : <><Plus size={16} aria-hidden="true" />Agregar animal</>}
        </button>
      </div>
      {showForm && (
        <AnimalForm
          loteId={lote.id}
          defaultSexo={lote.sexo}
          onDone={() => { setShowForm(false); onChange(); }}
        />
      )}
      {lote.animales.length === 0 ? (
        <p className="muted">Sin animales individuales registrados</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Identificador</th>
                <th>Sexo</th>
                <th className="num">Peso (kg)</th>
                <th>Fotos</th>
                <th>Notas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lote.animales.map((a) => (
                <AnimalRow key={a.id} animal={a} onChange={onChange} ask={ask} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AnimalForm({ loteId, defaultSexo, onDone }: { loteId: string; defaultSexo: Sexo; onDone: () => void }) {
  const [identificador, setIdentificador] = useState('');
  const [sexo, setSexo] = useState<Sexo>(defaultSexo);
  const [peso, setPeso] = useState('');
  const [criaSexo, setCriaSexo] = useState<CriaSexo | ''>('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api('/api/animales', {
        method: 'POST',
        body: {
          loteId,
          identificador: identificador || null,
          sexo,
          peso: peso === '' ? null : Number(peso),
          criaSexo: sexo === 'VP' && criaSexo ? criaSexo : null,
          notas: notas || null,
        },
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        background: 'var(--color-surface-2)',
        padding: 'var(--space-3)',
        borderRadius: 'var(--radius-lg)',
        margin: 'var(--space-2) 0 var(--space-3)',
      }}
    >
      <div className="grid-3">
        <div className="field">
          <label htmlFor="animal-id">Identificador</label>
          <input id="animal-id" type="text" value={identificador} onChange={(e) => setIdentificador(e.target.value)} placeholder="ej. AR-042" />
        </div>
        <div className="field">
          <label htmlFor="animal-sexo">Sexo</label>
          <select id="animal-sexo" value={sexo} onChange={(e) => setSexo(e.target.value as Sexo)}>
            {SEXOS.map((s) => <option key={s} value={s}>{SEXO_LABELS[s]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="animal-peso">Peso (kg)</label>
          <input id="animal-peso" type="number" step="0.01" min={0} value={peso} onChange={(e) => setPeso(e.target.value)} />
        </div>
      </div>
      {sexo === 'VP' && (
        <div className="field">
          <label htmlFor="animal-cria">Sexo de la cría</label>
          <select id="animal-cria" value={criaSexo} onChange={(e) => setCriaSexo(e.target.value as CriaSexo | '')}>
            <option value="">— sin especificar —</option>
            <option value="M">Macho</option>
            <option value="H">Hembra</option>
          </select>
        </div>
      )}
      <div className="field">
        <label htmlFor="animal-notas">Notas</label>
        <input id="animal-notas" type="text" value={notas} onChange={(e) => setNotas(e.target.value)} />
      </div>
      {error && (
        <div className="error" role="alert">
          <AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} /> {error}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="submit" disabled={loading}>{loading ? 'Guardando…' : 'Guardar animal'}</button>
      </div>
    </form>
  );
}

function AnimalRow({ animal, onChange, ask }: { animal: Animal; onChange: () => void; ask: Asker }) {
  const [uploading, setUploading] = useState(false);
  const anotaciones = animal.anotaciones ?? [];

  async function onDelete() {
    const ok = await ask({
      title: `¿Eliminar animal ${animal.identificador ?? animal.id.slice(0, 6)}?`,
      description: 'No se podrá recuperar.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;
    await api(`/api/animales/${animal.id}`, { method: 'DELETE' });
    onChange();
  }

  async function onFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('foto', file);
      fd.append('animalId', animal.id);
      await api('/api/fotos', { method: 'POST', body: fd });
      onChange();
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <tr>
        <td>{animal.identificador ?? <span className="muted">—</span>}</td>
        <td>
          <SexoBadge
            sexo={animal.sexo}
            criaSexo={animal.sexo === 'VP' ? animal.criaSexo : null}
          />
          {animal.sexo === 'VP' && animal.criaSexo && (
            <span className="muted" style={{ marginLeft: 6, fontSize: '0.75rem' }}>
              {CRIA_SEXO_LABELS[animal.criaSexo]}
            </span>
          )}
        </td>
        <td className="num">{animal.peso ? fmtNum(animal.peso) : '—'}</td>
        <td>
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            {(animal.fotos ?? []).slice(0, 3).map((f) => (
              <img key={f.id} className="thumb" src={`/uploads/${f.filename}`} alt="" />
            ))}
            <label className="btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
              {uploading ? '…' : <><Plus size={12} /> foto</>}
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                disabled={uploading}
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
            </label>
          </div>
        </td>
        <td>{animal.notas ?? <span className="muted">—</span>}</td>
        <td>
          <button
            type="button"
            className="btn-danger btn-icon btn-sm"
            onClick={onDelete}
            aria-label="Eliminar animal"
          >
            <Trash2 size={14} />
          </button>
        </td>
      </tr>
      <tr>
        <td colSpan={6} style={{ paddingTop: 0 }}>
          <Anotaciones
            compact
            target={{ animalId: animal.id }}
            anotaciones={anotaciones}
            onChange={onChange}
          />
        </td>
      </tr>
    </>
  );
}

function SeccionGastos({ lote, onChange, ask }: { lote: LoteDetalle; onChange: () => void; ask: Asker }) {
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const total = lote.gastos.reduce((s, g) => s + Number(g.monto), 0);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api('/api/gastos', {
        method: 'POST',
        body: { loteId: lote.id, descripcion, monto: Number(monto) },
      });
      setDescripcion('');
      setMonto('');
      onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(gasto: Gasto) {
    const ok = await ask({
      title: '¿Eliminar gasto?',
      description: gasto.descripcion,
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;
    await api(`/api/gastos/${gasto.id}`, { method: 'DELETE' });
    onChange();
  }

  return (
    <section className="card" style={{ marginBottom: 'var(--space-4)' }}>
      <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
        <h2 className="row" style={{ gap: 'var(--space-2)' }}>
          <Receipt size={18} aria-hidden="true" />
          Gastos extras
          <span className="muted tabnum">({lote.gastos.length})</span>
        </h2>
        <span className="badge" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}>
          Total: {fmtMoney(total)}
        </span>
      </div>
      <form onSubmit={onSubmit}>
        <div className="grid-3">
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label htmlFor="gasto-desc">Descripción</label>
            <input id="gasto-desc" type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} required placeholder="ej. Transporte, comisión…" />
          </div>
          <div className="field">
            <label htmlFor="gasto-monto">Monto ($)</label>
            <input id="gasto-monto" type="number" step="0.01" min={0} value={monto} onChange={(e) => setMonto(e.target.value)} required />
          </div>
        </div>
        {error && (
          <div className="error" role="alert">
            <AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} /> {error}
          </div>
        )}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="submit" disabled={loading}>
            <Plus size={16} aria-hidden="true" />
            {loading ? 'Guardando…' : 'Agregar gasto'}
          </button>
        </div>
      </form>
      {lote.gastos.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: 'var(--space-3)' }}>
          <table className="table">
            <thead>
              <tr><th>Fecha</th><th>Descripción</th><th className="num">Monto</th><th></th></tr>
            </thead>
            <tbody>
              {lote.gastos.map((g) => (
                <GastoRow key={g.id} gasto={g} onChange={onChange} onDelete={() => onDelete(g)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function GastoRow({
  gasto,
  onChange,
  onDelete,
}: {
  gasto: Gasto;
  onChange: () => void;
  onDelete: () => void;
}) {
  const anotaciones = gasto.anotaciones ?? [];
  return (
    <>
      <tr>
        <td>{fmtDate(gasto.fecha)}</td>
        <td>{gasto.descripcion}</td>
        <td className="num">{fmtMoney(gasto.monto)}</td>
        <td>
          <button
            type="button"
            className="btn-danger btn-icon btn-sm"
            onClick={onDelete}
            aria-label="Eliminar gasto"
          >
            <X size={14} />
          </button>
        </td>
      </tr>
      <tr>
        <td colSpan={4} style={{ paddingTop: 0 }}>
          <Anotaciones
            compact
            target={{ gastoId: gasto.id }}
            anotaciones={anotaciones}
            onChange={onChange}
          />
        </td>
      </tr>
    </>
  );
}
