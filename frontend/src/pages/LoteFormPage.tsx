import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Sexo, Lote } from '../types';
import { SEXO_LABELS } from '../types';

const SEXOS: Sexo[] = ['VP', 'HV', 'HL', 'ML', 'MC'];

export function LoteFormPage() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
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
    notas: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <div className="container">
      <h1>Nuevo lote</h1>
      <form onSubmit={onSubmit} className="card">
        <div className="grid-3">
          <div className="field">
            <label>Fecha</label>
            <input type="date" value={form.fecha} onChange={(e) => update('fecha', e.target.value)} required />
          </div>
          <div className="field">
            <label>N° feria</label>
            <input type="text" value={form.numeroFeria} onChange={(e) => update('numeroFeria', e.target.value)} />
          </div>
          <div className="field">
            <label>N° lote</label>
            <input type="text" value={form.loteNumero} onChange={(e) => update('loteNumero', e.target.value)} />
          </div>
        </div>

        <div className="grid-3">
          <div className="field">
            <label>Sexo</label>
            <select value={form.sexo} onChange={(e) => update('sexo', e.target.value as Sexo)}>
              {SEXOS.map((s) => (
                <option key={s} value={s}>{SEXO_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Cantidad</label>
            <input type="number" min={1} value={form.cantidad} onChange={(e) => update('cantidad', Number(e.target.value))} required />
          </div>
          <div className="field">
            <label>Referencia</label>
            <input type="text" value={form.referencia} onChange={(e) => update('referencia', e.target.value)} />
          </div>
        </div>

        <div className="grid-3">
          <div className="field">
            <label>Peso total (kg)</label>
            <input type="number" step="0.01" min={0} value={form.pesoTotal} onChange={(e) => update('pesoTotal', Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Peso promedio (kg)</label>
            <input type="number" step="0.01" min={0} value={form.pesoPromedio} onChange={(e) => update('pesoPromedio', e.target.value)} />
          </div>
          <div className="field">
            <label>Valor final ($/kg)</label>
            <input type="number" step="0.01" min={0} value={form.valorFinal} onChange={(e) => update('valorFinal', Number(e.target.value))} />
          </div>
        </div>

        <div className="grid-3">
          <div className="field">
            <label>Valor total ($)</label>
            <input type="number" step="0.01" min={0} value={form.valorTotal} onChange={(e) => update('valorTotal', Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Deducción ($)</label>
            <input type="number" step="0.01" min={0} value={form.deduccion} onChange={(e) => update('deduccion', Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Valor a pagar ($)</label>
            <input type="number" step="0.01" min={0} value={form.valorAPagar} onChange={(e) => update('valorAPagar', Number(e.target.value))} />
          </div>
        </div>

        <div className="field">
          <label>Notas</label>
          <textarea value={form.notas} onChange={(e) => update('notas', e.target.value)} rows={3} />
        </div>

        {error && <div className="error">{error}</div>}

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancelar</button>
          <button type="submit" disabled={loading}>{loading ? 'Guardando…' : 'Guardar lote'}</button>
        </div>
      </form>
    </div>
  );
}
