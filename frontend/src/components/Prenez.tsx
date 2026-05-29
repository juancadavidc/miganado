import { useState, type FormEvent } from 'react';
import { Baby, Trash2, Check, X, AlertCircle, Plus } from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { Prenez, PrenezEstado } from '../types';
import { PRENEZ_ESTADO_LABELS } from '../types';
import { fmtDate, toInputDate } from '../lib/format';
import { useConfirm } from './ConfirmDialog';

type Props = {
  animalId: string;
  prenez: Prenez[];
  onChange: () => void;
};

const ESTADOS: PrenezEstado[] = ['PRENADA', 'PARIO', 'ABORTO'];

export function PrenezControl({ animalId, prenez, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const { ask, dialog } = useConfirm();

  const count = prenez.length;
  const abierta = prenez.find((p) => p.estado === 'PRENADA');

  async function onDelete(p: Prenez) {
    const ok = await ask({
      title: '¿Eliminar evento de preñez?',
      description: `${PRENEZ_ESTADO_LABELS[p.estado]} · diagnóstico ${fmtDate(p.fechaDiagnostico)}`,
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;
    await api(`/api/prenez/${p.id}`, { method: 'DELETE' });
    onChange();
  }

  if (!open) {
    return (
      <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(true)}>
        <Baby size={12} aria-hidden="true" />
        {abierta ? 'Preñada' : count > 0 ? `${count} ${count === 1 ? 'preñez' : 'preñeces'}` : 'Preñez'}
      </button>
    );
  }

  return (
    <div className="anotaciones anotaciones--compact">
      <div className="row-between" style={{ marginBottom: 'var(--space-2)' }}>
        <strong style={{ fontSize: 'var(--text-sm)' }}>
          Preñez y partos <span className="muted tabnum">({count})</span>
        </strong>
        <button type="button" className="btn-ghost btn-icon btn-sm" onClick={() => setOpen(false)} aria-label="Cerrar">
          <X size={12} />
        </button>
      </div>

      {!showForm && (
        <button type="button" className="btn-sm" onClick={() => setShowForm(true)} disabled={!!abierta}>
          <Plus size={14} aria-hidden="true" />Registrar preñez
        </button>
      )}
      {abierta && !showForm && (
        <p className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)' }}>
          Ya hay una preñez abierta. Complétala (parto o aborto) antes de registrar otra.
        </p>
      )}

      {showForm && (
        <PrenezForm animalId={animalId} onDone={() => { setShowForm(false); onChange(); }} />
      )}

      {count > 0 && (
        <ul className="anotacion-list">
          {prenez.map((p) => (
            <PrenezItem key={p.id} prenez={p} onChange={onChange} onDelete={() => onDelete(p)} />
          ))}
        </ul>
      )}

      {dialog}
    </div>
  );
}

function PrenezForm({ animalId, onDone }: { animalId: string; onDone: () => void }) {
  const [estado, setEstado] = useState<PrenezEstado>('PRENADA');
  const [fechaDiagnostico, setFechaDiagnostico] = useState(toInputDate(new Date().toISOString()));
  const [fechaParto, setFechaParto] = useState('');
  const [criasMacho, setCriasMacho] = useState('0');
  const [criasHembra, setCriasHembra] = useState('0');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api('/api/prenez', {
        method: 'POST',
        body: {
          animalId,
          estado,
          fechaDiagnostico,
          fechaParto: estado === 'PARIO' ? (fechaParto || null) : null,
          criasMacho: estado === 'PARIO' ? Number(criasMacho) : 0,
          criasHembra: estado === 'PARIO' ? Number(criasHembra) : 0,
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
        margin: 'var(--space-2) 0',
      }}
    >
      <div className="grid-3">
        <div className="field">
          <label htmlFor="prenez-estado">Estado</label>
          <select id="prenez-estado" value={estado} onChange={(e) => setEstado(e.target.value as PrenezEstado)}>
            {ESTADOS.map((s) => <option key={s} value={s}>{PRENEZ_ESTADO_LABELS[s]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="prenez-diag">Fecha de diagnóstico</label>
          <input id="prenez-diag" type="date" value={fechaDiagnostico} onChange={(e) => setFechaDiagnostico(e.target.value)} required />
        </div>
      </div>
      {estado === 'PARIO' && (
        <div className="grid-3">
          <div className="field">
            <label htmlFor="prenez-parto">Fecha de parto</label>
            <input id="prenez-parto" type="date" value={fechaParto} onChange={(e) => setFechaParto(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="prenez-machos">Crías macho</label>
            <input id="prenez-machos" type="number" min={0} value={criasMacho} onChange={(e) => setCriasMacho(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="prenez-hembras">Crías hembra</label>
            <input id="prenez-hembras" type="number" min={0} value={criasHembra} onChange={(e) => setCriasHembra(e.target.value)} />
          </div>
        </div>
      )}
      <div className="field">
        <label htmlFor="prenez-notas">Notas</label>
        <input id="prenez-notas" type="text" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="ej. parto sin novedad" />
      </div>
      {error && (
        <div className="error" role="alert">
          <AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} /> {error}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="submit" disabled={loading}>{loading ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  );
}

function PrenezItem({ prenez, onChange, onDelete }: { prenez: Prenez; onChange: () => void; onDelete: () => void }) {
  const [completing, setCompleting] = useState(false);

  const crias = prenez.criasMacho + prenez.criasHembra;

  return (
    <li className="anotacion-item">
      <div className="anotacion-meta">
        <strong style={{ fontSize: 'var(--text-sm)' }}>{PRENEZ_ESTADO_LABELS[prenez.estado]}</strong>
        <time>diagnóstico {fmtDate(prenez.fechaDiagnostico)}</time>
      </div>
      <p className="anotacion-texto">
        {prenez.estado === 'PARIO' && (
          <>
            Parió {fmtDate(prenez.fechaParto)}
            {crias > 0
              ? ` · ${crias} ${crias === 1 ? 'cría' : 'crías'} (${prenez.criasMacho} M / ${prenez.criasHembra} H)`
              : ' · sin crías registradas'}
          </>
        )}
        {prenez.estado === 'ABORTO' && 'Perdió la preñez'}
        {prenez.estado === 'PRENADA' && 'Esperando parto'}
        {prenez.notas && <span className="muted"> — {prenez.notas}</span>}
      </p>
      <div className="anotacion-actions">
        {prenez.estado === 'PRENADA' && !completing && (
          <button type="button" className="btn-sm" onClick={() => setCompleting(true)}>
            <Check size={12} />Completar
          </button>
        )}
        <button type="button" className="btn-danger btn-icon btn-sm" onClick={onDelete} aria-label="Eliminar evento">
          <Trash2 size={12} />
        </button>
      </div>
      {completing && (
        <CompletarPrenez prenez={prenez} onDone={() => { setCompleting(false); onChange(); }} onCancel={() => setCompleting(false)} />
      )}
    </li>
  );
}

function CompletarPrenez({ prenez, onDone, onCancel }: { prenez: Prenez; onDone: () => void; onCancel: () => void }) {
  const [estado, setEstado] = useState<'PARIO' | 'ABORTO'>('PARIO');
  const [fechaParto, setFechaParto] = useState(toInputDate(new Date().toISOString()));
  const [criasMacho, setCriasMacho] = useState('0');
  const [criasHembra, setCriasHembra] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/prenez/${prenez.id}`, {
        method: 'PUT',
        body: {
          estado,
          fechaParto: estado === 'PARIO' ? (fechaParto || null) : null,
          criasMacho: estado === 'PARIO' ? Number(criasMacho) : 0,
          criasHembra: estado === 'PARIO' ? Number(criasHembra) : 0,
        },
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        background: 'var(--color-surface-2)',
        padding: 'var(--space-3)',
        borderRadius: 'var(--radius-lg)',
        marginTop: 'var(--space-2)',
      }}
    >
      <div className="grid-3">
        <div className="field">
          <label htmlFor="comp-estado">Resultado</label>
          <select id="comp-estado" value={estado} onChange={(e) => setEstado(e.target.value as 'PARIO' | 'ABORTO')}>
            <option value="PARIO">Parió</option>
            <option value="ABORTO">Aborto</option>
          </select>
        </div>
        {estado === 'PARIO' && (
          <>
            <div className="field">
              <label htmlFor="comp-parto">Fecha de parto</label>
              <input id="comp-parto" type="date" value={fechaParto} onChange={(e) => setFechaParto(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="comp-machos">Crías macho</label>
              <input id="comp-machos" type="number" min={0} value={criasMacho} onChange={(e) => setCriasMacho(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="comp-hembras">Crías hembra</label>
              <input id="comp-hembras" type="number" min={0} value={criasHembra} onChange={(e) => setCriasHembra(e.target.value)} />
            </div>
          </>
        )}
      </div>
      {error && (
        <div className="error" role="alert">
          <AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} /> {error}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
        <button type="button" className="btn-secondary btn-sm" onClick={onCancel}>Cancelar</button>
        <button type="button" className="btn-sm" onClick={save} disabled={saving}>{saving ? '…' : 'Guardar'}</button>
      </div>
    </div>
  );
}
