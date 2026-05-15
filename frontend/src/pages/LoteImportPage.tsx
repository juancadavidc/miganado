import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, AlertCircle, Sparkles, Trash2, Plus, ImageIcon } from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { Sexo, Lote } from '../types';

const SEXOS: Sexo[] = ['VP', 'HV', 'HL', 'ML', 'MC', 'TO'];

type Row = {
  fecha: string;
  numeroFeria: string;
  loteNumero: string;
  sexo: Sexo;
  cantidad: number;
  pesoTotal: number;
  pesoPromedio: number;
  valorFinal: number;
  valorTotal: number;
  deduccion: number;
  referencia: string;
  valorAPagar: number;
};

type ExtractedRow = Partial<Row> & { sexo?: string; fecha?: string };

const SEXO_SET = new Set<Sexo>(SEXOS);

function normalizeRow(r: ExtractedRow): Row {
  const sexo = (SEXO_SET.has(r.sexo as Sexo) ? r.sexo : 'VP') as Sexo;
  const cantidad = Math.max(1, Number(r.cantidad ?? 1) || 1);
  const pesoTotal = Number(r.pesoTotal ?? 0) || 0;
  const pesoPromedio = Number(r.pesoPromedio ?? (cantidad > 0 ? pesoTotal / cantidad : 0)) || 0;
  const valorFinal = Number(r.valorFinal ?? 0) || 0;
  const valorTotal = Number(r.valorTotal ?? Math.round(pesoTotal * valorFinal)) || 0;
  const deduccion = Number(r.deduccion ?? 0) || 0;
  const valorAPagar = Number(r.valorAPagar ?? Math.max(0, valorTotal - deduccion)) || 0;
  return {
    fecha: r.fecha || new Date().toISOString().slice(0, 10),
    numeroFeria: String(r.numeroFeria ?? ''),
    loteNumero: String(r.loteNumero ?? ''),
    sexo,
    cantidad,
    pesoTotal,
    pesoPromedio,
    valorFinal,
    valorTotal,
    deduccion,
    referencia: String(r.referencia ?? ''),
    valorAPagar,
  };
}

function emptyRow(): Row {
  return {
    fecha: new Date().toISOString().slice(0, 10),
    numeroFeria: '',
    loteNumero: '',
    sexo: 'VP',
    cantidad: 1,
    pesoTotal: 0,
    pesoPromedio: 0,
    valorFinal: 0,
    valorTotal: 0,
    deduccion: 0,
    referencia: '',
    valorAPagar: 0,
  };
}

export function LoteImportPage() {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function extractFromFile(file: File) {
    setError(null);
    setExtracting(true);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(file));
    try {
      const fd = new FormData();
      fd.append('imagen', file);
      const data = await api<{ rows: ExtractedRow[] }>('/api/lotes/extract', {
        method: 'POST',
        body: fd,
      });
      const normalized = (data.rows ?? []).map(normalizeRow);
      if (normalized.length === 0) {
        setError('No se detectaron filas en la imagen. Asegúrate de que la tabla sea legible.');
      }
      setRows(normalized);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al procesar la imagen');
    } finally {
      setExtracting(false);
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) extractFromFile(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) extractFromFile(file);
  }

  function updateRow(idx: number, patch: Partial<Row>) {
    setRows((prev) => {
      const next = [...prev];
      const r = { ...next[idx], ...patch };
      // Recalcular derivados si cambia peso/cantidad/valor/deducción
      if ('pesoTotal' in patch || 'cantidad' in patch) {
        r.pesoPromedio = r.cantidad > 0 ? +(r.pesoTotal / r.cantidad).toFixed(2) : 0;
      }
      if ('pesoTotal' in patch || 'valorFinal' in patch) {
        r.valorTotal = Math.round(r.pesoTotal * r.valorFinal);
      }
      if ('pesoTotal' in patch || 'valorFinal' in patch || 'deduccion' in patch || 'valorTotal' in patch) {
        r.valorAPagar = Math.max(0, r.valorTotal - r.deduccion);
      }
      next[idx] = r;
      return next;
    });
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  async function onSave() {
    setError(null);
    setSaving(true);
    try {
      await api<{ lotes: Lote[] }>('/api/lotes/bulk', {
        method: 'POST',
        body: { lotes: rows },
      });
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 1180 }}>
      <header className="page-header">
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <button type="button" className="btn-ghost btn-icon" onClick={() => navigate(-1)} aria-label="Volver">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>Importar desde imagen</h1>
            <p className="subtitle">Sube la planilla de la feria y revisa los lotes detectados antes de guardar</p>
          </div>
        </div>
      </header>

      {!imageUrl && (
        <div
          className={`dropzone${dragOver ? ' is-over' : ''}`}
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.current?.click(); }}
        >
          <div className="dropzone-inner">
            <span className="dropzone-icon"><Upload size={26} /></span>
            <div style={{ fontWeight: 600 }}>Arrastra la imagen aquí o haz clic para elegir</div>
            <div className="muted">JPG / PNG / WEBP · hasta 10 MB</div>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            onChange={onFileChange}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {imageUrl && (
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
            <div className="row" style={{ gap: 'var(--space-2)' }}>
              <ImageIcon size={16} aria-hidden="true" />
              <strong>Planilla cargada</strong>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                if (imageUrl) URL.revokeObjectURL(imageUrl);
                setImageUrl(null);
                setRows([]);
                setError(null);
              }}
            >
              Cambiar imagen
            </button>
          </div>
          <img src={imageUrl} alt="Planilla" className="dropzone-preview" />
        </div>
      )}

      {extracting && (
        <div className="callout" style={{ marginBottom: 'var(--space-4)' }}>
          <Sparkles size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
          Leyendo la planilla con IA…
        </div>
      )}

      {error && (
        <div className="error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          <AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
          {error}
        </div>
      )}

      {rows.length > 0 && (
        <div className="card card-pad-0" style={{ overflowX: 'auto' }}>
          <table className="table table-edit">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Feria</th>
                <th>Lote</th>
                <th>Sexo</th>
                <th className="num">Cant.</th>
                <th className="num">Peso total</th>
                <th className="num">Peso prom.</th>
                <th className="num">Valor final</th>
                <th className="num">Valor total</th>
                <th className="num">Deducción</th>
                <th className="num">A pagar</th>
                <th>Referencia</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td><input type="date" value={r.fecha} onChange={(e) => updateRow(i, { fecha: e.target.value })} /></td>
                  <td><input type="text" value={r.numeroFeria} onChange={(e) => updateRow(i, { numeroFeria: e.target.value })} style={{ width: 64 }} /></td>
                  <td><input type="text" value={r.loteNumero} onChange={(e) => updateRow(i, { loteNumero: e.target.value })} style={{ width: 64 }} /></td>
                  <td>
                    <select value={r.sexo} onChange={(e) => updateRow(i, { sexo: e.target.value as Sexo })}>
                      {SEXOS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td><input className="num" type="number" min={1} value={r.cantidad} onChange={(e) => updateRow(i, { cantidad: Number(e.target.value) || 0 })} style={{ width: 70 }} /></td>
                  <td><input className="num" type="number" step="0.01" min={0} value={r.pesoTotal} onChange={(e) => updateRow(i, { pesoTotal: Number(e.target.value) || 0 })} style={{ width: 100 }} /></td>
                  <td><input className="num" type="number" step="0.01" min={0} value={r.pesoPromedio} onChange={(e) => updateRow(i, { pesoPromedio: Number(e.target.value) || 0 })} style={{ width: 100 }} /></td>
                  <td><input className="num" type="number" step="0.01" min={0} value={r.valorFinal} onChange={(e) => updateRow(i, { valorFinal: Number(e.target.value) || 0 })} style={{ width: 100 }} /></td>
                  <td><input className="num" type="number" step="0.01" min={0} value={r.valorTotal} onChange={(e) => updateRow(i, { valorTotal: Number(e.target.value) || 0 })} style={{ width: 120 }} /></td>
                  <td><input className="num" type="number" step="0.01" min={0} value={r.deduccion} onChange={(e) => updateRow(i, { deduccion: Number(e.target.value) || 0 })} style={{ width: 100 }} /></td>
                  <td><input className="num" type="number" step="0.01" min={0} value={r.valorAPagar} onChange={(e) => updateRow(i, { valorAPagar: Number(e.target.value) || 0 })} style={{ width: 120 }} /></td>
                  <td><input type="text" value={r.referencia} onChange={(e) => updateRow(i, { referencia: e.target.value })} style={{ width: 110 }} /></td>
                  <td>
                    <button type="button" className="btn-ghost btn-icon" onClick={() => removeRow(i)} aria-label="Eliminar fila">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {imageUrl && !extracting && (
        <div className="row" style={{ marginTop: 'var(--space-3)', justifyContent: 'space-between' }}>
          <button type="button" className="btn-secondary" onClick={addRow}>
            <Plus size={14} aria-hidden="true" /> Agregar fila
          </button>
          <div className="muted">{rows.length} {rows.length === 1 ? 'lote' : 'lotes'} listos para crear</div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="sticky-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancelar</button>
          <button type="button" disabled={saving} onClick={onSave}>
            {saving ? 'Creando…' : `Crear ${rows.length} ${rows.length === 1 ? 'lote' : 'lotes'}`}
          </button>
        </div>
      )}
    </div>
  );
}
