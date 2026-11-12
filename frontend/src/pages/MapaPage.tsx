import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { api } from '../api/client';
import type { Finca, Potrero, Sexo } from '../types';
import { SexoBadge } from '../components/SexoBadge';
import { diasDesde, fmtDate, fmtDias, fmtNum } from '../lib/format';

// Vista "viva" de la finca: cada potrero es un campo con sus animales caminando.
// Tocar un animal abre su ficha. Los registros se hacen por el chat de Telegram,
// así que la vista se refresca sola para mostrar lo que el agente va guardando.

type AnimalMapa = {
  id: string;
  identificador: string | null;
  sexo: Sexo;
  peso: string | null;
  notas: string | null;
  madreId: string | null;
  esCria: boolean;
  nacimiento: string | null;
  destetadoAt: string | null;
};

type LoteMapa = {
  id: string;
  potreroId: string | null;
  potreroDesde: string | null;
  fecha: string;
  loteNumero: string | null;
  numeroFeria: string | null;
  sexo: Sexo;
  cantidad: number;
  cabezas: number;
  pesoCompra: number | null;
  pesoActual: number | null;
  ultimoPesaje: string | null;
  animales: AnimalMapa[];
};

type MapaData = {
  finca: { id: string; nombre: string; capacidad: number };
  potreros: Potrero[];
  lotes: LoteMapa[];
};

// Una cabeza dibujada: pertenece a un lote y, si está registrada sola, a un animal.
type Cabeza = { key: string; lote: LoteMapa; animal: AnimalMapa | null; cria: boolean };

const MAX_POR_CAMPO = 40;
const REFRESCO_MS = 20_000;
const HEMBRAS: Sexo[] = ['VP', 'HV', 'HL'];

function cabezasDe(lote: LoteMapa): Cabeza[] {
  // Las cabezas compradas se dibujan con sus animales registrados; las crías van
  // aparte (pequeñas mientras están al pie, de tamaño normal ya destetadas).
  const individuales = lote.animales.filter((a) => !a.esCria);
  const crias = lote.animales.filter((a) => a.esCria);
  const out: Cabeza[] = [];
  for (let i = 0; i < lote.cabezas; i++) {
    out.push({ key: `${lote.id}-${i}`, lote, animal: individuales[i] ?? null, cria: false });
  }
  for (const c of crias) out.push({ key: c.id, lote, animal: c, cria: !c.destetadoAt });
  return out;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function Vaca({ cabeza, onClick }: { cabeza: Cabeza; onClick: () => void }) {
  const [pos, setPos] = useState(() => ({ x: rand(6, 88), y: rand(18, 80) }));
  const [dur, setDur] = useState(0);
  const [mira, setMira] = useState(Math.random() < 0.5 ? 1 : -1);
  const [caminando, setCaminando] = useState(false);
  const posRef = useRef(pos);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let t: number;
    const siguiente = () => {
      t = window.setTimeout(() => {
        // La mayoría del tiempo pastan quietas; de vez en cuando dan unos pasos.
        if (Math.random() < 0.35) {
          setCaminando(false);
          return siguiente();
        }
        const cur = posRef.current;
        const nx = clamp(cur.x + rand(-22, 22), 4, 90);
        const ny = clamp(cur.y + rand(-18, 18), 16, 82);
        const d = Math.hypot(nx - cur.x, ny - cur.y);
        const s = Math.max(1.2, d / 6);
        posRef.current = { x: nx, y: ny };
        setMira(nx < cur.x ? 1 : -1);
        setDur(s);
        setCaminando(true);
        setPos({ x: nx, y: ny });
        window.setTimeout(() => setCaminando(false), s * 1000);
        siguiente();
      }, rand(2500, 7000));
    };
    siguiente();
    return () => window.clearTimeout(t);
  }, []);

  const emoji = HEMBRAS.includes(cabeza.animal?.sexo ?? cabeza.lote.sexo) ? '🐄' : '🐂';
  const etiqueta = cabeza.animal?.identificador ?? (cabeza.lote.loteNumero ? `Lote ${cabeza.lote.loteNumero}` : 'Animal');
  return (
    <button
      type="button"
      className={`vaca${caminando ? ' is-caminando' : ''}${cabeza.cria ? ' is-cria' : ''}${cabeza.animal ? ' is-individual' : ''}`}
      style={{ left: `${pos.x}%`, top: `${pos.y}%`, transitionDuration: `${dur}s` }}
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
    >
      <span className="vaca-cuerpo" style={{ transform: `scaleX(${mira})` }}>{emoji}</span>
    </button>
  );
}

function Campo({
  titulo, sub, ocupado, cabezas, onSelect,
}: {
  titulo: string;
  sub: string;
  ocupado: boolean | null;
  cabezas: Cabeza[];
  onSelect: (c: Cabeza) => void;
}) {
  const visibles = cabezas.slice(0, MAX_POR_CAMPO);
  const extra = cabezas.length - visibles.length;
  const alto = 150 + Math.min(cabezas.length, MAX_POR_CAMPO) * 4;
  return (
    <section
      className={`campo${ocupado === null ? ' is-corral' : ocupado ? ' is-ocupado' : ' is-descanso'}`}
      style={{ minHeight: alto }}
    >
      <header className="campo-head">
        <strong>{titulo}</strong>
        <span>{sub}</span>
      </header>
      {cabezas.length === 0 && <div className="campo-vacio">🌱 En descanso</div>}
      {visibles.map((c) => (
        <Vaca key={c.key} cabeza={c} onClick={() => onSelect(c)} />
      ))}
      {extra > 0 && <span className="campo-extra">+{extra} más</span>}
    </section>
  );
}

function Ficha({ cabeza, potrero, onClose }: { cabeza: Cabeza; potrero: Potrero | null; onClose: () => void }) {
  const { lote, animal } = cabeza;
  const ganado = lote.pesoCompra != null && lote.pesoActual != null ? lote.pesoActual - lote.pesoCompra : null;
  const esCria = !!animal?.esCria;
  // El peso del lote es de las cabezas compradas: a una cría solo se le muestra el suyo.
  const peso = animal?.peso != null ? Number(animal.peso) : esCria ? null : lote.pesoActual;
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal ficha" role="dialog" aria-modal="true" aria-label="Ficha del animal">
        <div className="row-between">
          <h2 style={{ margin: 0 }}>
            {animal?.identificador ?? (esCria ? 'Cría' : 'Animal')}{' '}
            <span className="muted" style={{ fontWeight: 400 }}>
              · {lote.loteNumero ? `Lote ${lote.loteNumero}` : 'Lote sin número'}
            </span>
          </h2>
          <button type="button" className="btn-ghost btn-icon" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div style={{ margin: 'var(--space-3) 0' }}>
          <SexoBadge sexo={animal?.sexo ?? lote.sexo} showLabel />
        </div>
        <dl className="ficha-datos">
          <div><dt>Peso{animal?.peso != null ? '' : ' promedio'}</dt><dd>{peso != null ? `${fmtNum(peso, 0)} kg` : '—'}</dd></div>
          {!animal?.peso && !esCria && ganado != null && (
            <div><dt>Ganado desde la compra</dt><dd>{ganado >= 0 ? '+' : ''}{fmtNum(ganado, 0)} kg</dd></div>
          )}
          {esCria ? (
            <>
              <div><dt>Edad</dt><dd>{animal?.nacimiento ? `${fmtDias(diasDesde(animal.nacimiento))} · ${fmtDate(animal.nacimiento)}` : '—'}</dd></div>
              <div><dt>Estado</dt><dd>{animal?.destetadoAt ? `destetada el ${fmtDate(animal.destetadoAt)}` : 'al pie de la madre'}</dd></div>
            </>
          ) : (
            <>
              <div><dt>Último pesaje</dt><dd>{lote.ultimoPesaje ? fmtDate(lote.ultimoPesaje) : 'sin pesajes'}</dd></div>
              <div><dt>Comprado</dt><dd>{fmtDate(lote.fecha)} · hace {fmtDias(diasDesde(lote.fecha))}</dd></div>
            </>
          )}
          <div><dt>Potrero</dt><dd>{potrero ? `${potrero.nombre} · ${fmtDias(diasDesde(lote.potreroDesde))}` : 'sin asignar'}</dd></div>
          <div><dt>Lote</dt><dd>{lote.cabezas} de {lote.cantidad} cabezas en finca</dd></div>
        </dl>
        {animal?.notas && <p className="potrero-notas">{animal.notas}</p>}
        <div className="modal-actions">
          <Link to={`/lotes/${lote.id}`} className="btn btn-sm">Ver lote completo</Link>
        </div>
      </div>
    </div>
  );
}

export function MapaPage() {
  const { fincaId } = useParams();
  const navigate = useNavigate();
  const [fincas, setFincas] = useState<Finca[] | null>(null);
  const [data, setData] = useState<MapaData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<Cabeza | null>(null);

  useEffect(() => {
    api<{ fincas: Finca[] }>('/api/fincas')
      .then((d) => {
        setFincas(d.fincas);
        if (!fincaId && d.fincas[0]) navigate(`/mapa/${d.fincas[0].id}`, { replace: true });
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!fincaId) return;
    let vivo = true;
    const cargar = () =>
      api<MapaData>(`/api/mapa?fincaId=${encodeURIComponent(fincaId)}`)
        .then((d) => vivo && (setData(d), setError(null)))
        .catch((e) => vivo && setError(e.message));
    cargar();
    const t = window.setInterval(cargar, REFRESCO_MS);
    return () => { vivo = false; window.clearInterval(t); };
  }, [fincaId]);

  const porPotrero = useMemo(() => {
    const m = new Map<string | null, Cabeza[]>();
    for (const l of data?.lotes ?? []) {
      const k = data!.potreros.some((p) => p.id === l.potreroId) ? l.potreroId : null;
      m.set(k, [...(m.get(k) ?? []), ...cabezasDe(l)]);
    }
    return m;
  }, [data]);

  if (fincas && fincas.length === 0) {
    return (
      <div className="container">
        <p className="muted">Aún no tienes fincas. Créala en <Link to="/fincas">Fincas</Link> o pídesela al asistente.</p>
      </div>
    );
  }

  const total = data?.lotes.reduce((s, l) => s + l.cabezas, 0) ?? 0;
  const sinPotrero = porPotrero.get(null) ?? [];
  const potreroSel = sel ? data?.potreros.find((p) => p.id === sel.lote.potreroId) ?? null : null;

  return (
    <div className="container">
      <div className="row-between" style={{ marginBottom: 'var(--space-4)', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>{data?.finca.nombre ?? 'Mapa'}</h1>
          <span className="muted">{total} {total === 1 ? 'cabeza' : 'cabezas'} en finca</span>
        </div>
        {fincas && fincas.length > 1 && (
          <select value={fincaId ?? ''} onChange={(e) => navigate(`/mapa/${e.target.value}`)} aria-label="Finca">
            {fincas.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
          </select>
        )}
      </div>

      {error && <div className="error" role="alert">{error}</div>}
      {!data && !error && <p className="muted">Cargando…</p>}

      {data && (
        <div className="campos">
          {data.potreros.map((p) => {
            const cabezas = porPotrero.get(p.id) ?? [];
            const dias = fmtDias(diasDesde(p.ocupado ? p.ocupadoDesde : p.vacioDesde));
            return (
              <Campo
                key={p.id}
                titulo={p.nombre}
                sub={cabezas.length > 0 ? `${cabezas.length} · ${dias}` : `descanso · ${dias}`}
                ocupado={cabezas.length > 0}
                cabezas={cabezas}
                onSelect={setSel}
              />
            );
          })}
          {sinPotrero.length > 0 && (
            <Campo titulo="Sin potrero" sub={`${sinPotrero.length}`} ocupado={null} cabezas={sinPotrero} onSelect={setSel} />
          )}
          {data.potreros.length === 0 && sinPotrero.length === 0 && (
            <p className="muted">No hay potreros ni ganado todavía.</p>
          )}
        </div>
      )}

      {sel && <Ficha cabeza={sel} potrero={potreroSel} onClose={() => setSel(null)} />}
    </div>
  );
}
