import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Beef, Sprout, Pencil, Trash2, Move, MapPinOff, Plus } from 'lucide-react';
import type { Potrero } from '../types';
import { diasDesde, fmtDias } from '../lib/format';

// Debe coincidir con GRID_COLS del backend (backend/src/routes/potreros.ts).
const GRID_COLS = 16;
const MIN_ROWS = 6;

export type GridCoords = {
  gridX?: number | null;
  gridY?: number | null;
  gridW?: number;
  gridH?: number;
};

type Rect = { x: number; y: number; w: number; h: number };

type Props = {
  potreros: Potrero[];
  busyId: string | null;
  onPersist: (id: string, coords: GridCoords) => void | Promise<void>;
  onToggle: (p: Potrero) => void;
  onEdit: (p: Potrero) => void;
  onDelete: (p: Potrero) => void;
};

type DragState = {
  id: string;
  mode: 'move' | 'resize';
  startX: number;
  startY: number;
  ox: number;
  oy: number;
  ow: number;
  oh: number;
  cell: number;
};

type Preview = { id: string; x: number; y: number; w: number; h: number; valid: boolean };

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function PotreroMapa({ potreros, busyId, onPersist, onToggle, onEdit, onDelete }: Props) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [cellPx, setCellPx] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const previewRef = useRef<Preview | null>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const measure = () => setCellPx(el.clientWidth / GRID_COLS);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const placed = potreros.filter((p) => p.gridX !== null && p.gridY !== null);
  const unplaced = potreros.filter((p) => p.gridX === null || p.gridY === null);

  function setPv(p: Preview | null) {
    previewRef.current = p;
    setPreview(p);
  }

  function rectOf(p: Potrero): Rect {
    if (preview && preview.id === p.id) {
      return { x: preview.x, y: preview.y, w: preview.w, h: preview.h };
    }
    return { x: p.gridX!, y: p.gridY!, w: p.gridW, h: p.gridH };
  }

  function overlapsOthers(id: string, rect: Rect): boolean {
    return placed.some(
      (p) => p.id !== id && rectsOverlap(rect, { x: p.gridX!, y: p.gridY!, w: p.gridW, h: p.gridH }),
    );
  }

  function firstFreeCell(w: number, h: number): { x: number; y: number } {
    const others = placed.map((p) => ({ x: p.gridX!, y: p.gridY!, w: p.gridW, h: p.gridH }));
    for (let y = 0; y < 200; y++) {
      for (let x = 0; x <= GRID_COLS - w; x++) {
        const cand = { x, y, w, h };
        if (!others.some((o) => rectsOverlap(cand, o))) return { x, y };
      }
    }
    return { x: 0, y: 0 };
  }

  function onPointerDown(e: ReactPointerEvent, p: Potrero, mode: 'move' | 'resize') {
    if (!editMode) return;
    const el = canvasRef.current;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const cell = el.clientWidth / GRID_COLS;
    dragRef.current = {
      id: p.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      ox: p.gridX!,
      oy: p.gridY!,
      ow: p.gridW,
      oh: p.gridH,
      cell,
    };
    setPv({ id: p.id, x: p.gridX!, y: p.gridY!, w: p.gridW, h: p.gridH, valid: true });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const dx = Math.round((e.clientX - d.startX) / d.cell);
    const dy = Math.round((e.clientY - d.startY) / d.cell);
    let x = d.ox;
    let y = d.oy;
    let w = d.ow;
    let h = d.oh;
    if (d.mode === 'move') {
      x = clamp(d.ox + dx, 0, GRID_COLS - d.ow);
      y = Math.max(0, d.oy + dy);
    } else {
      w = clamp(d.ow + dx, 1, GRID_COLS - d.ox);
      h = Math.max(1, d.oh + dy);
    }
    const valid = !overlapsOthers(d.id, { x, y, w, h });
    setPv({ id: d.id, x, y, w, h, valid });
  }

  function onPointerUp() {
    const d = dragRef.current;
    const pv = previewRef.current;
    dragRef.current = null;
    setPv(null);
    if (!d || !pv) return;
    const changed = pv.x !== d.ox || pv.y !== d.oy || pv.w !== d.ow || pv.h !== d.oh;
    if (pv.valid && changed) {
      onPersist(d.id, { gridX: pv.x, gridY: pv.y, gridW: pv.w, gridH: pv.h });
    }
  }

  function colocar(p: Potrero) {
    const { x, y } = firstFreeCell(p.gridW, p.gridH);
    onPersist(p.id, { gridX: x, gridY: y });
  }

  function quitarDelMapa(p: Potrero) {
    setSelectedId(null);
    onPersist(p.id, { gridX: null, gridY: null });
  }

  // Filas visibles = la fila más baja ocupada (incluida la preview) + colchón.
  const allRects = placed.map(rectOf);
  const maxRow = allRects.reduce((m, r) => Math.max(m, r.y + r.h), 0);
  const rows = Math.max(MIN_ROWS, maxRow + (editMode ? 2 : 1));

  const selected = selectedId ? potreros.find((p) => p.id === selectedId) ?? null : null;

  return (
    <div className="mapa">
      <div className="mapa-toolbar">
        <button
          type="button"
          className={editMode ? 'btn btn-sm' : 'btn-secondary btn-sm'}
          onClick={() => {
            setEditMode((v) => !v);
            setSelectedId(null);
          }}
          aria-pressed={editMode}
        >
          <Move size={15} aria-hidden="true" />
          {editMode ? 'Listo' : 'Editar disposición'}
        </button>
        <span className="muted mapa-hint">
          {editMode
            ? 'Arrastrá para mover · esquina para redimensionar'
            : 'Tocá un potrero para ver sus acciones'}
        </span>
      </div>

      <div
        ref={canvasRef}
        className={`mapa-canvas${editMode ? ' is-editing' : ''}`}
        style={{
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, ${cellPx}px)`,
          backgroundSize: `${cellPx}px ${cellPx}px`,
        }}
      >
        {placed.length === 0 && (
          <div className="mapa-empty muted">
            {unplaced.length > 0
              ? 'Colocá un potrero desde la bandeja de abajo.'
              : 'Aún no hay potreros.'}
          </div>
        )}

        {placed.map((p) => {
          const r = rectOf(p);
          const isPreview = preview?.id === p.id;
          const invalid = isPreview && !preview!.valid;
          const dias = diasDesde(p.ocupado ? p.ocupadoDesde : p.vacioDesde);
          return (
            <div
              key={p.id}
              className={[
                'mapa-tile',
                p.ocupado ? 'is-ocupado' : 'is-libre',
                selectedId === p.id ? 'is-selected' : '',
                isPreview ? 'is-dragging' : '',
                invalid ? 'is-invalid' : '',
              ].filter(Boolean).join(' ')}
              style={{ gridColumn: `${r.x + 1} / span ${r.w}`, gridRow: `${r.y + 1} / span ${r.h}` }}
              role="button"
              tabIndex={0}
              aria-label={p.nombre}
              onPointerDown={(e) => onPointerDown(e, p, 'move')}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onClick={() => {
                if (!editMode) setSelectedId((cur) => (cur === p.id ? null : p.id));
              }}
            >
              <div className="mapa-tile-body">
                <span className="mapa-tile-ico" aria-hidden="true">
                  {p.ocupado ? <Beef size={14} /> : <Sprout size={14} />}
                </span>
                <span className="mapa-tile-nombre">{p.nombre}</span>
                <span className="mapa-tile-dias">{fmtDias(dias)}</span>
              </div>
              {editMode && (
                <span
                  className="mapa-handle"
                  aria-hidden="true"
                  onPointerDown={(e) => onPointerDown(e, p, 'resize')}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                />
              )}
            </div>
          );
        })}
      </div>

      {selected && !editMode && (
        <div className="mapa-detail card">
          <div className="row-between">
            <div className="row" style={{ gap: 'var(--space-2)' }}>
              <span className={`badge ${selected.ocupado ? 'is-ocupado' : 'is-libre'}`}>
                {selected.ocupado ? 'Ocupado' : 'En descanso'}
              </span>
              <strong>{selected.nombre}</strong>
            </div>
            <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
              {selected.ocupado ? 'Con ganado' : 'Sin ganado'} hace{' '}
              {fmtDias(diasDesde(selected.ocupado ? selected.ocupadoDesde : selected.vacioDesde))}
            </span>
          </div>
          <div className="mapa-detail-actions">
            <button
              type="button"
              className={selected.ocupado ? 'btn-secondary btn-sm' : 'btn btn-sm'}
              onClick={() => onToggle(selected)}
              disabled={busyId === selected.id}
            >
              {selected.ocupado ? 'Liberar' : 'Marcar ocupado'}
            </button>
            <div className="nav-spacer" />
            <button type="button" className="btn-ghost btn-icon" onClick={() => onEdit(selected)} aria-label="Editar">
              <Pencil size={16} />
            </button>
            <button type="button" className="btn-ghost btn-icon" onClick={() => quitarDelMapa(selected)} aria-label="Quitar del mapa">
              <MapPinOff size={16} />
            </button>
            <button type="button" className="btn-ghost btn-icon" onClick={() => onDelete(selected)} aria-label="Eliminar">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      )}

      {unplaced.length > 0 && (
        <div className="mapa-tray">
          <div className="mapa-tray-title">Sin ubicar</div>
          <div className="mapa-tray-chips">
            {unplaced.map((p) => (
              <button
                key={p.id}
                type="button"
                className="mapa-chip"
                onClick={() => colocar(p)}
                disabled={busyId === p.id}
                title="Colocar en el mapa"
              >
                <Plus size={14} aria-hidden="true" />
                {p.nombre}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
