import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Animal, CriaSexo, Foto, Gasto, LoteDetalle, Sexo } from '../types';
import { CRIA_SEXO_LABELS, SEXO_LABELS, SEXO_SHORT } from '../types';
import { fmtDate, fmtMoney, fmtNum } from '../lib/format';

const SEXOS: Sexo[] = ['VP', 'HV', 'HL', 'ML', 'MC', 'TO'];

export function LoteDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lote, setLote] = useState<LoteDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    if (!confirm('¿Eliminar este lote y todo su contenido?')) return;
    try {
      await api(`/api/lotes/${lote.id}`, { method: 'DELETE' });
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    }
  }

  if (loading) return <div className="container">Cargando…</div>;
  if (error) return <div className="container"><div className="error">{error}</div></div>;
  if (!lote) return <div className="container">Lote no encontrado</div>;

  const gastosTotal = lote.gastos.reduce((s, g) => s + Number(g.monto), 0);
  const utilidad = Number(lote.valorAPagar) - gastosTotal;

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h1>Lote {lote.loteNumero ?? '—'} · {fmtDate(lote.fecha)}</h1>
          <p className="muted">
            Feria {lote.numeroFeria ?? '—'} · <span className="badge">{SEXO_SHORT[lote.sexo]}</span> · {lote.cantidad} cabezas · Ref. {lote.referencia ?? '—'}
            {lote.sexo === 'VP' && (lote.criasMacho > 0 || lote.criasHembra > 0) && (
              <> · Crías: <strong>{lote.criasMacho}</strong>🐂 / <strong>{lote.criasHembra}</strong>🐄</>
            )}
          </p>
        </div>
        <button className="btn-danger" onClick={onDelete}>Eliminar lote</button>
      </div>

      <div className="grid-3" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <div className="muted">Peso total / promedio</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
            {fmtNum(lote.pesoTotal)} kg
            <span className="muted" style={{ fontSize: '0.85rem' }}> · {fmtNum(lote.pesoPromedio)} kg/cab</span>
          </div>
        </div>
        <div className="card">
          <div className="muted">Valor total / deducción</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
            {fmtMoney(lote.valorTotal)}
            <span className="muted" style={{ fontSize: '0.85rem' }}> · −{fmtMoney(lote.deduccion)}</span>
          </div>
        </div>
        <div className="card">
          <div className="muted">A pagar · Utilidad (− gastos)</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
            {fmtMoney(lote.valorAPagar)}
            <span className="muted" style={{ fontSize: '0.85rem' }}> · {fmtMoney(utilidad)}</span>
          </div>
        </div>
      </div>

      <SeccionFotos lote={lote} onChange={cargar} />
      <SeccionAnimales lote={lote} onChange={cargar} />
      <SeccionGastos lote={lote} onChange={cargar} />
    </div>
  );
}

function SeccionFotos({ lote, onChange }: { lote: LoteDetalle; onChange: () => void }) {
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
    if (!confirm('¿Eliminar foto?')) return;
    try {
      await api(`/api/fotos/${foto.id}`, { method: 'DELETE' });
      onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    }
  }

  return (
    <section className="card" style={{ marginBottom: '1rem' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Fotos del lote ({lote.fotos.length})</h2>
        <label className="btn">
          {uploading ? 'Subiendo…' : '+ Subir foto'}
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            disabled={uploading}
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>
      </div>
      {error && <div className="error">{error}</div>}
      {lote.fotos.length === 0 ? (
        <p className="muted">Sin fotos</p>
      ) : (
        <div className="photo-grid">
          {lote.fotos.map((f) => (
            <div key={f.id} style={{ position: 'relative' }}>
              <img src={`/uploads/${f.filename}`} alt="" />
              <button
                className="btn-danger"
                style={{ position: 'absolute', top: 4, right: 4, padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
                onClick={() => onDelete(f)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SeccionAnimales({ lote, onChange }: { lote: LoteDetalle; onChange: () => void }) {
  const [showForm, setShowForm] = useState(false);
  return (
    <section className="card" style={{ marginBottom: '1rem' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Animales individuales ({lote.animales.length})</h2>
        <button onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancelar' : '+ Agregar animal'}
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
                <th>Peso (kg)</th>
                <th>Fotos</th>
                <th>Notas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lote.animales.map((a) => (
                <AnimalRow key={a.id} animal={a} onChange={onChange} />
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
    <form onSubmit={onSubmit} style={{ background: '#fafbf7', padding: '0.75rem', borderRadius: 8, margin: '0.5rem 0' }}>
      <div className="grid-3">
        <div className="field">
          <label>Identificador</label>
          <input type="text" value={identificador} onChange={(e) => setIdentificador(e.target.value)} placeholder="ej. AR-042" />
        </div>
        <div className="field">
          <label>Sexo</label>
          <select value={sexo} onChange={(e) => setSexo(e.target.value as Sexo)}>
            {SEXOS.map((s) => <option key={s} value={s}>{SEXO_LABELS[s]}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Peso (kg)</label>
          <input type="number" step="0.01" min={0} value={peso} onChange={(e) => setPeso(e.target.value)} />
        </div>
      </div>
      {sexo === 'VP' && (
        <div className="field">
          <label>Sexo de la cría</label>
          <select value={criaSexo} onChange={(e) => setCriaSexo(e.target.value as CriaSexo | '')}>
            <option value="">— sin especificar —</option>
            <option value="M">Macho</option>
            <option value="H">Hembra</option>
          </select>
        </div>
      )}
      <div className="field">
        <label>Notas</label>
        <input type="text" value={notas} onChange={(e) => setNotas(e.target.value)} />
      </div>
      {error && <div className="error">{error}</div>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="submit" disabled={loading}>{loading ? 'Guardando…' : 'Guardar animal'}</button>
      </div>
    </form>
  );
}

function AnimalRow({ animal, onChange }: { animal: Animal; onChange: () => void }) {
  const [uploading, setUploading] = useState(false);

  async function onDelete() {
    if (!confirm(`¿Eliminar animal ${animal.identificador ?? animal.id.slice(0, 6)}?`)) return;
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
    <tr>
      <td>{animal.identificador ?? <span className="muted">—</span>}</td>
      <td>
        <span className="badge">{SEXO_SHORT[animal.sexo]}</span>
        {animal.sexo === 'VP' && animal.criaSexo && (
          <span className="muted" style={{ marginLeft: 4, fontSize: '0.75rem' }}>
            +{CRIA_SEXO_LABELS[animal.criaSexo]}
          </span>
        )}
      </td>
      <td>{animal.peso ? fmtNum(animal.peso) : '—'}</td>
      <td>
        <div className="row">
          {(animal.fotos ?? []).slice(0, 3).map((f) => (
            <img key={f.id} src={`/uploads/${f.filename}`} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4 }} />
          ))}
          <label style={{ cursor: 'pointer', color: 'var(--primary)', fontSize: '0.85rem' }}>
            {uploading ? '…' : '+ foto'}
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
        <button className="btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={onDelete}>Eliminar</button>
      </td>
    </tr>
  );
}

function SeccionGastos({ lote, onChange }: { lote: LoteDetalle; onChange: () => void }) {
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
    if (!confirm('¿Eliminar gasto?')) return;
    await api(`/api/gastos/${gasto.id}`, { method: 'DELETE' });
    onChange();
  }

  return (
    <section className="card" style={{ marginBottom: '1rem' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Gastos extras ({lote.gastos.length}) · {fmtMoney(total)}</h2>
      </div>
      <form onSubmit={onSubmit}>
        <div className="grid-3">
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label>Descripción</label>
            <input type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} required />
          </div>
          <div className="field">
            <label>Monto ($)</label>
            <input type="number" step="0.01" min={0} value={monto} onChange={(e) => setMonto(e.target.value)} required />
          </div>
        </div>
        {error && <div className="error">{error}</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="submit" disabled={loading}>{loading ? 'Guardando…' : '+ Agregar gasto'}</button>
        </div>
      </form>
      {lote.gastos.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
          <table className="table">
            <thead>
              <tr><th>Fecha</th><th>Descripción</th><th>Monto</th><th></th></tr>
            </thead>
            <tbody>
              {lote.gastos.map((g) => (
                <tr key={g.id}>
                  <td>{fmtDate(g.fecha)}</td>
                  <td>{g.descripcion}</td>
                  <td>{fmtMoney(g.monto)}</td>
                  <td>
                    <button className="btn-danger" style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }} onClick={() => onDelete(g)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
