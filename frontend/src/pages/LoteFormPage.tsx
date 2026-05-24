import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, AlertCircle, Upload } from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { Sexo, Lote, Finca } from '../types';
import { SEXO_LABELS } from '../types';

const SEXOS: Sexo[] = ['VP', 'HV', 'HL', 'ML', 'MC', 'TO'];

export function LoteFormPage() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    fincaId: '',
    fecha: today,
    numeroFeria: '',
    loteNumero: '',
    sexo: 'VP' as Sexo,
    cantidad: 1,
    pesoTotal: 0,
    pesoPromedio: '',
    valorFinal: 0,
    valorTotal: 0,
    deduccion: 0,
    referencia: '',
    valorAPagar: 0,
    criasMacho: 0,
    criasHembra: 0,
    notas: '',
  });
  const [fincas, setFincas] = useState<Finca[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<{ fincas: Finca[] }>('/api/fincas')
      .then((d) => {
        setFincas(d.fincas);
        if (d.fincas[0]) setForm((f) => (f.fincaId ? f : { ...f, fincaId: d.fincas[0].id }));
      })
      .catch(() => { /* el form muestra el aviso de crear finca */ });
  }, []);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'pesoTotal' || key === 'cantidad') {
        const cant = Number(next.cantidad) || 0;
        const peso = Number(next.pesoTotal) || 0;
        if (cant > 0 && peso > 0) {
          next.pesoPromedio = (peso / cant).toFixed(2);
        }
      }
      if (key === 'pesoTotal' || key === 'valorFinal') {
        const peso = Number(next.pesoTotal) || 0;
        const valFinal = Number(next.valorFinal) || 0;
        if (peso > 0 && valFinal > 0) {
          next.valorTotal = Math.round(peso * valFinal);
        }
      }
      if (key === 'valorTotal' || key === 'deduccion') {
        const total = Number(next.valorTotal) || 0;
        const ded = Number(next.deduccion) || 0;
        next.valorAPagar = Math.max(0, total - ded);
      }
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api<{ lote: Lote }>('/api/lotes', {
        method: 'POST',
        body: {
          ...form,
          pesoPromedio: form.pesoPromedio === '' ? null : Number(form.pesoPromedio),
        },
      });
      navigate(`/lotes/${data.lote.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 880 }}>
      <header className="page-header">
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <button type="button" className="btn-ghost btn-icon" onClick={() => navigate(-1)} aria-label="Volver">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>Nuevo lote</h1>
            <p className="subtitle">Registra una entrega a la feria</p>
          </div>
        </div>
        <Link to="/lotes/importar" className="btn-secondary">
          <Upload size={16} aria-hidden="true" />
          Importar desde imagen
        </Link>
      </header>

      <form onSubmit={onSubmit} className="card">
        <div className="form-section">
          <div className="form-section-title">Datos generales</div>
          <div className="field">
            <label htmlFor="finca">Finca</label>
            <select id="finca" value={form.fincaId} onChange={(e) => update('fincaId', e.target.value)} required>
              {fincas.length === 0 && <option value="">— no tenés fincas —</option>}
              {fincas.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
            {fincas.length === 0 && (
              <div className="helper">Creá una finca primero en <Link to="/fincas">Fincas</Link>.</div>
            )}
          </div>
          <div className="grid-3">
            <div className="field">
              <label htmlFor="fecha">Fecha</label>
              <input id="fecha" type="date" value={form.fecha} onChange={(e) => update('fecha', e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="numeroFeria">N° de feria</label>
              <input id="numeroFeria" type="text" value={form.numeroFeria} onChange={(e) => update('numeroFeria', e.target.value)} placeholder="ej. 1453" />
            </div>
            <div className="field">
              <label htmlFor="loteNumero">N° de lote</label>
              <input id="loteNumero" type="text" value={form.loteNumero} onChange={(e) => update('loteNumero', e.target.value)} placeholder="ej. 12" />
            </div>
          </div>
          <div className="grid-3">
            <div className="field">
              <label htmlFor="sexo">Sexo</label>
              <select id="sexo" value={form.sexo} onChange={(e) => update('sexo', e.target.value as Sexo)}>
                {SEXOS.map((s) => <option key={s} value={s}>{SEXO_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="cantidad">Cantidad</label>
              <input id="cantidad" type="number" min={1} value={form.cantidad} onChange={(e) => update('cantidad', Number(e.target.value))} required />
            </div>
            <div className="field">
              <label htmlFor="referencia">Referencia</label>
              <input id="referencia" type="text" value={form.referencia} onChange={(e) => update('referencia', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title">Pesos y valor</div>
          <div className="callout" style={{ marginBottom: 'var(--space-3)' }}>
            <Sparkles size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            Algunos campos se calculan automáticamente: peso promedio, valor total y valor a pagar.
          </div>
          <div className="grid-3">
            <div className="field">
              <label htmlFor="pesoTotal">Peso total</label>
              <input id="pesoTotal" type="number" step="0.01" min={0} value={form.pesoTotal} onChange={(e) => update('pesoTotal', Number(e.target.value))} />
              <div className="helper">kilogramos</div>
            </div>
            <div className="field">
              <label htmlFor="pesoPromedio">Peso promedio</label>
              <input id="pesoPromedio" type="number" step="0.01" min={0} value={form.pesoPromedio} onChange={(e) => update('pesoPromedio', e.target.value)} />
              <div className="helper">kg / cabeza · auto</div>
            </div>
            <div className="field">
              <label htmlFor="valorFinal">Valor final</label>
              <input id="valorFinal" type="number" step="0.01" min={0} value={form.valorFinal} onChange={(e) => update('valorFinal', Number(e.target.value))} />
              <div className="helper">$ por kilo</div>
            </div>
          </div>
          <div className="grid-3">
            <div className="field">
              <label htmlFor="valorTotal">Valor total</label>
              <input id="valorTotal" type="number" step="0.01" min={0} value={form.valorTotal} onChange={(e) => update('valorTotal', Number(e.target.value))} />
              <div className="helper">$ · auto desde peso × valor</div>
            </div>
            <div className="field">
              <label htmlFor="deduccion">Deducción</label>
              <input id="deduccion" type="number" step="0.01" min={0} value={form.deduccion} onChange={(e) => update('deduccion', Number(e.target.value))} />
              <div className="helper">$ a descontar</div>
            </div>
            <div className="field">
              <label htmlFor="valorAPagar">Valor a pagar</label>
              <input id="valorAPagar" type="number" step="0.01" min={0} value={form.valorAPagar} onChange={(e) => update('valorAPagar', Number(e.target.value))} />
              <div className="helper">$ · auto</div>
            </div>
          </div>
        </div>

        {form.sexo === 'VP' && (
          <div className="form-section">
            <div className="form-section-title">Crías (vacas paridas)</div>
            <div className="callout">
              Indica cuántas crías macho y hembra acompañan a las vacas paridas de este lote.
            </div>
            <div className="grid-2" style={{ marginTop: 'var(--space-3)' }}>
              <div className="field">
                <label htmlFor="criasMacho">Crías macho</label>
                <input id="criasMacho" type="number" min={0} value={form.criasMacho} onChange={(e) => update('criasMacho', Number(e.target.value))} />
              </div>
              <div className="field">
                <label htmlFor="criasHembra">Crías hembra</label>
                <input id="criasHembra" type="number" min={0} value={form.criasHembra} onChange={(e) => update('criasHembra', Number(e.target.value))} />
              </div>
            </div>
          </div>
        )}

        <div className="form-section">
          <div className="form-section-title">Notas</div>
          <div className="field">
            <textarea
              value={form.notas}
              onChange={(e) => update('notas', e.target.value)}
              rows={3}
              placeholder="Cualquier observación adicional sobre el lote…"
            />
          </div>
        </div>

        {error && (
          <div className="error" role="alert">
            <AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            {error}
          </div>
        )}

        <div className="sticky-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancelar</button>
          <button type="submit" disabled={loading || !form.fincaId}>{loading ? 'Guardando…' : 'Guardar lote'}</button>
        </div>
      </form>
    </div>
  );
}
