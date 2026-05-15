import { useState, type FormEvent } from 'react';
import { MessageSquarePlus, Trash2, Pencil, Check, X, AlertCircle } from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { Anotacion } from '../types';
import { fmtDate } from '../lib/format';
import { useConfirm } from './ConfirmDialog';

type Target =
  | { loteId: string }
  | { animalId: string }
  | { gastoId: string };

type Props = {
  target: Target;
  anotaciones: Anotacion[];
  onChange: () => void;
  /** estilo compacto: usado dentro de filas de tabla / sub-items */
  compact?: boolean;
};

export function Anotaciones({ target, anotaciones, onChange, compact = false }: Props) {
  const [texto, setTexto] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(!compact);
  const { ask, dialog } = useConfirm();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const t = texto.trim();
    if (!t) return;
    setAdding(true);
    setError(null);
    try {
      await api('/api/anotaciones', { method: 'POST', body: { ...target, texto: t } });
      setTexto('');
      onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setAdding(false);
    }
  }

  async function onDelete(a: Anotacion) {
    const ok = await ask({
      title: '¿Eliminar anotación?',
      description: a.texto,
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api(`/api/anotaciones/${a.id}`, { method: 'DELETE' });
      onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    }
  }

  const count = anotaciones.length;

  if (compact && !open) {
    return (
      <button
        type="button"
        className="btn-ghost btn-sm"
        onClick={() => setOpen(true)}
      >
        <MessageSquarePlus size={12} aria-hidden="true" />
        {count > 0 ? `${count} ${count === 1 ? 'anotación' : 'anotaciones'}` : 'Anotar'}
      </button>
    );
  }

  return (
    <div className={compact ? 'anotaciones anotaciones--compact' : 'anotaciones'}>
      {compact && (
        <div className="row-between" style={{ marginBottom: 'var(--space-2)' }}>
          <strong style={{ fontSize: 'var(--text-sm)' }}>
            Anotaciones <span className="muted tabnum">({count})</span>
          </strong>
          <button type="button" className="btn-ghost btn-icon btn-sm" onClick={() => setOpen(false)} aria-label="Cerrar">
            <X size={12} />
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} className="anotacion-form">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Agregar anotación…"
          maxLength={2000}
        />
        <button type="submit" disabled={adding || !texto.trim()} className="btn-sm">
          {adding ? '…' : <><MessageSquarePlus size={14} aria-hidden="true" />Agregar</>}
        </button>
      </form>

      {error && (
        <div className="error" role="alert" style={{ marginTop: 'var(--space-2)' }}>
          <AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} /> {error}
        </div>
      )}

      {anotaciones.length > 0 && (
        <ul className="anotacion-list">
          {anotaciones.map((a) => (
            <AnotacionItem key={a.id} anotacion={a} onChange={onChange} onDelete={() => onDelete(a)} />
          ))}
        </ul>
      )}

      {dialog}
    </div>
  );
}

function AnotacionItem({
  anotacion,
  onChange,
  onDelete,
}: {
  anotacion: Anotacion;
  onChange: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(anotacion.texto);
  const [saving, setSaving] = useState(false);

  async function save() {
    const t = draft.trim();
    if (!t || t === anotacion.texto) {
      setEditing(false);
      setDraft(anotacion.texto);
      return;
    }
    setSaving(true);
    try {
      await api(`/api/anotaciones/${anotacion.id}`, { method: 'PUT', body: { texto: t } });
      setEditing(false);
      onChange();
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="anotacion-item">
      <div className="anotacion-meta">
        <time>{fmtDate(anotacion.createdAt)}</time>
        {anotacion.updatedAt !== anotacion.createdAt && (
          <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>· editada</span>
        )}
      </div>
      {editing ? (
        <div className="anotacion-edit">
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') { setEditing(false); setDraft(anotacion.texto); }
            }}
            maxLength={2000}
          />
          <button type="button" className="btn-icon btn-sm" onClick={save} disabled={saving} aria-label="Guardar">
            <Check size={12} />
          </button>
          <button
            type="button"
            className="btn-ghost btn-icon btn-sm"
            onClick={() => { setEditing(false); setDraft(anotacion.texto); }}
            aria-label="Cancelar"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <>
          <p className="anotacion-texto">{anotacion.texto}</p>
          <div className="anotacion-actions">
            <button
              type="button"
              className="btn-ghost btn-icon btn-sm"
              onClick={() => setEditing(true)}
              aria-label="Editar anotación"
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              className="btn-danger btn-icon btn-sm"
              onClick={onDelete}
              aria-label="Eliminar anotación"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </>
      )}
    </li>
  );
}
