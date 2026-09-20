import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Trash2, Plus, X, Upload, Camera, ImageOff,
  AlertCircle, Receipt, ListOrdered, Calendar, MessageSquare, Users,
  Scale, Info, Banknote, CheckCircle2,
} from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { Animal, CriaSexo, Foto, Gasto, LoteDetalle, Sexo, Venta } from '../types';
import { CRIA_SEXO_LABELS, SEXO_LABELS } from '../types';
import { fmtDate, fmtMoney, fmtNum, fmtDias, toInputDate } from '../lib/format';
import { calcularPesajes } from '../lib/pesajes';
import { precioPorKg, resumenVentas } from '../lib/ventas';
import { SexoBadge } from '../components/SexoBadge';
import { useConfirm } from '../components/ConfirmDialog';
import { Anotaciones } from '../components/Anotaciones';
import { PrenezControl } from '../components/Prenez';
import { useAuth } from '../auth/AuthContext';

const SEXOS: Sexo[] = ['VP', 'HV', 'HL', 'ML', 'MC', 'TO'];

export function LoteDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
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
  const invertido = Number(lote.valorAPagar) + gastosTotal;
  const meId = user?.id ?? '';
  const esDueno = lote.finca?.dueno?.id === meId;
  const ventas = resumenVentas(lote, lote.ventas, lote.gastos);

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
              {ventas.cerrado
                ? `${lote.cantidad} ${lote.cantidad === 1 ? 'cabeza vendida' : 'cabezas vendidas'}`
                : ventas.vendidas > 0
                  ? `${ventas.enFinca} en finca de ${lote.cantidad}`
                  : `${lote.cantidad} ${lote.cantidad === 1 ? 'cabeza' : 'cabezas'}`}
              {ventas.cerrado && (
                <span className="badge" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
                  Vendido
                </span>
              )}
              {lote.referencia && (<><span aria-hidden="true">·</span>Ref. {lote.referencia}</>)}
            </p>
          </div>
        </div>
        {esDueno && (
          <button className="btn-danger" onClick={onDelete}>
            <Trash2 size={16} aria-hidden="true" />
            Eliminar lote
          </button>
        )}
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
          <div className="label-cap">Costo de compra</div>
          <div className="kpi-value" style={{ color: 'var(--color-primary)' }}>{fmtMoney(lote.valorAPagar)}</div>
          <div className="kpi-sub">Invertido (+ gastos): <strong className="tabnum">{fmtMoney(invertido)}</strong></div>
        </div>
      </section>

      <SeccionPropiedad lote={lote} meId={meId} />
      <SeccionPesajes lote={lote} onChange={cargar} ask={ask} />
      <SeccionVentas lote={lote} esDueno={esDueno} onChange={cargar} ask={ask} />
      <SeccionFotos lote={lote} onChange={cargar} ask={ask} />
      <SeccionAnotacionesLote lote={lote} onChange={cargar} />
      <SeccionAnimales lote={lote} esDueno={esDueno} onChange={cargar} ask={ask} />
      <SeccionGastos lote={lote} onChange={cargar} ask={ask} />

      {dialog}
    </div>
  );
}

type Asker = ReturnType<typeof useConfirm>['ask'];

function Persona({ rol, persona, meId, nota }: { rol: string; persona?: { id: string; nombre: string; documento: string } | null; meId: string; nota?: string }) {
  return (
    <div>
      <div className="label-cap">{rol}</div>
      {persona ? (
        <>
          <div style={{ fontWeight: 600 }}>
            {persona.nombre}
            {persona.id === meId && <span className="muted" style={{ fontWeight: 400 }}> (vos)</span>}
          </div>
          <div className="muted" style={{ fontSize: '0.8rem' }}>Doc. {persona.documento}{nota ? ` · ${nota}` : ''}</div>
        </>
      ) : (
        <div className="muted">— sin asignar —</div>
      )}
    </div>
  );
}

function SeccionPropiedad({ lote, meId }: { lote: LoteDetalle; meId: string }) {
  const finca = lote.finca;
  const cuidadorEsDueno = !!finca?.cuidador && finca.cuidador.id === finca.dueno?.id;
  const esCuidador = finca?.cuidador?.id === meId && finca?.dueno?.id !== meId;

  return (
    <section className="card" style={{ marginBottom: 'var(--space-4)' }}>
      <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
        <h2 className="row" style={{ gap: 'var(--space-2)' }}>
          <Users size={18} aria-hidden="true" />
          Propiedad y cuidado
        </h2>
        {finca && (
          <Link to={`/fincas/${finca.id}`} className="btn-secondary btn-sm">
            Gestionar en la finca
          </Link>
        )}
      </div>

      <div className="grid-3" style={{ gap: 'var(--space-3)' }}>
        <div>
          <div className="label-cap">Finca</div>
          <div style={{ fontWeight: 600 }}>{finca?.nombre ?? '—'}</div>
        </div>
        <Persona rol="Dueño" persona={finca?.dueno} meId={meId} />
        <Persona
          rol="Cuidador"
          persona={finca?.cuidador}
          meId={meId}
          nota={cuidadorEsDueno ? 'el mismo dueño' : undefined}
        />
      </div>

      <p className="muted" style={{ marginTop: 'var(--space-3)' }}>
        {esCuidador
          ? 'Cuidás esta finca. Podés registrar pesos, animales, gastos, fotos y anotaciones. Los valores comerciales y la asignación de roles los maneja el dueño.'
          : 'El dueño y el cuidador se asignan a nivel de finca y se heredan a todos sus lotes.'}
      </p>
    </section>
  );
}

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

function fmtGanancia(kg: number | null): string {
  if (kg === null) return '—';
  const signo = kg > 0 ? '+' : '';
  return `${signo}${fmtNum(kg, 1)} kg`;
}

function fmtGmd(gramosDia: number | null): string {
  if (gramosDia === null) return '—';
  const signo = gramosDia > 0 ? '+' : '';
  return `${signo}${fmtNum(gramosDia, 0)} g/día`;
}

function colorGanancia(kg: number | null): string | undefined {
  if (kg === null || kg === 0) return undefined;
  return kg > 0 ? 'var(--color-primary)' : 'var(--color-danger)';
}

function SeccionPesajes({ lote, onChange, ask }: { lote: LoteDetalle; onChange: () => void; ask: Asker }) {
  const resumen = calcularPesajes(lote, lote.pesajes);
  const hayPesajes = lote.pesajes.length > 0;

  async function onDelete(id: string) {
    const ok = await ask({
      title: '¿Eliminar este pesaje?',
      description: 'Se recalculará la GMD del lote. No se podrá recuperar.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;
    await api(`/api/pesajes/${id}`, { method: 'DELETE' });
    onChange();
  }

  return (
    <section className="card" style={{ marginBottom: 'var(--space-4)' }}>
      <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
        <h2 className="row" style={{ gap: 'var(--space-2)' }}>
          <Scale size={18} aria-hidden="true" />
          Pesajes y GMD
          <span className="muted tabnum">({lote.pesajes.length})</span>
        </h2>
      </div>

      {hayPesajes && (
        <div className="grid-3" style={{ marginBottom: 'var(--space-3)' }}>
          <div className="tile">
            <div className="label-cap">Peso promedio actual</div>
            <div className="kpi-value">{fmtNum(resumen.ultimoPromedio, 1)} kg</div>
            <div className="kpi-sub">por cabeza</div>
          </div>
          <div className="tile">
            <div className="label-cap">
              {resumen.baseDesdeCompra ? 'Ganancia desde la compra' : 'Ganancia desde el 1er pesaje'}
            </div>
            <div className="kpi-value" style={{ color: colorGanancia(resumen.kgGanadosDesdeInicio) }}>
              {fmtGanancia(resumen.kgGanadosDesdeInicio)}
            </div>
            <div className="kpi-sub">por cabeza</div>
          </div>
          <div className="tile">
            <div className="label-cap">GMD promedio</div>
            <div className="kpi-value">{fmtGmd(resumen.gmdGlobal)}</div>
            <div className="kpi-sub">ganancia media diaria</div>
          </div>
        </div>
      )}

      <PesajeForm loteId={lote.id} defaultCantidad={lote.cantidad} onDone={onChange} />

      <div className="callout row" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
        <Info size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
        <span>Para que la GMD sea confiable, pesá siempre en las mismas condiciones (ej. con ayuno) y a la misma hora.</span>
      </div>

      {!hayPesajes ? (
        <p className="muted" style={{ marginTop: 'var(--space-3)' }}>
          {resumen.baseDesdeCompra
            ? 'Sin pesajes en finca. Al registrar el primero, la GMD se calcula desde el peso de compra.'
            : 'Sin pesajes registrados. Registrá al menos dos para empezar a ver la GMD.'}
        </p>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 'var(--space-3)' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th className="num">Cabezas</th>
                <th className="num">Peso total</th>
                <th className="num">Promedio/cab</th>
                <th className="num">Ganancia</th>
                <th>Nota</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {resumen.filas.map((f) => (
                <tr key={f.id ?? 'compra'}>
                  <td>
                    {fmtDate(f.fecha)}
                    {f.esCompra && (
                      <span className="badge" style={{ marginLeft: 6, background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
                        compra
                      </span>
                    )}
                  </td>
                  <td className="num">
                    {f.cantidad}
                    {!f.esCompra && f.cantidad !== lote.cantidad && (
                      <span className="muted" style={{ marginLeft: 4, fontSize: '0.7rem' }} title="Distinta a la cantidad del lote (venta parcial o baja)">
                        ≠ {lote.cantidad}
                      </span>
                    )}
                  </td>
                  <td className="num">{fmtNum(f.pesoTotal)} kg</td>
                  <td className="num tabnum">{fmtNum(f.pesoPromedio, 1)} kg</td>
                  <td className="num">
                    {f.esCompra ? (
                      <span className="muted">—</span>
                    ) : (
                      <>
                        <span style={{ color: colorGanancia(f.kgGanados), fontWeight: 600 }}>
                          {fmtGanancia(f.kgGanados)}
                        </span>
                        <div className="kpi-sub tabnum">
                          {fmtGmd(f.gmdGramosDia)}
                          {f.diasDesdeAnterior !== null && ` · ${fmtDias(f.diasDesdeAnterior)}`}
                        </div>
                      </>
                    )}
                  </td>
                  <td>{f.notas ?? <span className="muted">—</span>}</td>
                  <td>
                    {!f.esCompra && f.id && (
                      <button
                        type="button"
                        className="btn-danger btn-icon btn-sm"
                        onClick={() => onDelete(f.id!)}
                        aria-label="Eliminar pesaje"
                      >
                        <X size={14} />
                      </button>
                    )}
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

function PesajeForm({ loteId, defaultCantidad, onDone }: { loteId: string; defaultCantidad: number; onDone: () => void }) {
  const [fecha, setFecha] = useState(() => toInputDate(new Date().toISOString()));
  const [cantidad, setCantidad] = useState(String(defaultCantidad));
  const [pesoTotal, setPesoTotal] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api('/api/pesajes', {
        method: 'POST',
        body: {
          loteId,
          fecha,
          cantidad: Number(cantidad),
          pesoTotal: Number(pesoTotal),
          notas: notas || null,
        },
      });
      setPesoTotal('');
      setNotas('');
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="grid-3">
        <div className="field">
          <label htmlFor="pesaje-fecha">Fecha</label>
          <input id="pesaje-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="pesaje-cantidad">Cabezas pesadas</label>
          <input id="pesaje-cantidad" type="number" min={1} step={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="pesaje-peso">Peso total (kg)</label>
          <input id="pesaje-peso" type="number" step="0.01" min={0} value={pesoTotal} onChange={(e) => setPesoTotal(e.target.value)} required placeholder="ej. 9800" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="pesaje-notas">Nota (opcional)</label>
        <input id="pesaje-notas" type="text" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="ej. con ayuno, báscula del corral" />
      </div>
      {error && (
        <div className="error" role="alert">
          <AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} /> {error}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="submit" disabled={loading}>
          <Plus size={16} aria-hidden="true" />
          {loading ? 'Guardando…' : 'Registrar pesaje'}
        </button>
      </div>
    </form>
  );
}

function fmtPrecioKg(v: number | null): string {
  if (v === null) return '—';
  return `${fmtMoney(v)}/kg`;
}

// Las salidas del lote. La compra es una sola; las ventas son varias, porque se
// sacan las cabezas que ya estan listas y el resto sigue cebandose.
function SeccionVentas({
  lote, esDueno, onChange, ask,
}: { lote: LoteDetalle; esDueno: boolean; onChange: () => void; ask: Asker }) {
  const [showForm, setShowForm] = useState(false);
  const resumen = resumenVentas(lote, lote.ventas, lote.gastos);
  const hayVentas = lote.ventas.length > 0;

  async function onDelete(venta: Venta) {
    const ok = await ask({
      title: '¿Eliminar esta venta?',
      description: `Las ${venta.cantidad} ${venta.cantidad === 1 ? 'cabeza vuelve' : 'cabezas vuelven'} a contar como en finca.`,
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;
    await api(`/api/ventas/${venta.id}`, { method: 'DELETE' });
    onChange();
  }

  return (
    <section className="card" style={{ marginBottom: 'var(--space-4)' }}>
      <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
        <h2 className="row" style={{ gap: 'var(--space-2)' }}>
          <Banknote size={18} aria-hidden="true" />
          Ventas
          <span className="muted tabnum">({lote.ventas.length})</span>
        </h2>
        {esDueno && !resumen.cerrado && (
          <button className={showForm ? 'btn-secondary' : ''} onClick={() => setShowForm((v) => !v)}>
            {showForm
              ? <><X size={16} aria-hidden="true" />Cancelar</>
              : <><Plus size={16} aria-hidden="true" />Registrar venta</>}
          </button>
        )}
      </div>

      {hayVentas && (
        <div className="grid-3" style={{ marginBottom: 'var(--space-3)' }}>
          <div className="tile">
            <div className="label-cap">Cabezas vendidas</div>
            <div className="kpi-value">{resumen.vendidas} <span className="muted" style={{ fontSize: '0.9rem' }}>de {lote.cantidad}</span></div>
            <div className="kpi-sub">
              {resumen.cerrado ? 'lote vendido completo' : `quedan ${resumen.enFinca} en finca`}
            </div>
          </div>
          <div className="tile">
            <div className="label-cap">Ingresos por venta</div>
            <div className="kpi-value">{fmtMoney(resumen.ingresos)}</div>
            <div className="kpi-sub">neto recibido</div>
          </div>
          {resumen.cerrado ? (
            <div className="tile">
              <div className="label-cap">Utilidad neta</div>
              <div className="kpi-value" style={{ color: resumen.utilidad >= 0 ? 'var(--color-primary)' : 'var(--color-danger)' }}>
                {fmtMoney(resumen.utilidad)}
              </div>
              <div className="kpi-sub">ingresos − compra − gastos</div>
            </div>
          ) : (
            <div className="tile">
              <div className="label-cap">Invertido</div>
              <div className="kpi-value">{fmtMoney(resumen.invertido)}</div>
              <div className="kpi-sub">compra + gastos · la utilidad se ve al vender todo</div>
            </div>
          )}
        </div>
      )}

      {esDueno && showForm && !resumen.cerrado && (
        <VentaForm
          loteId={lote.id}
          maxCabezas={resumen.enFinca}
          onDone={() => { setShowForm(false); onChange(); }}
        />
      )}

      {!hayVentas ? (
        <p className="muted">
          {esDueno
            ? 'Sin ventas registradas. Cuando saques una cabeza o el lote completo, registralo acá para ver la utilidad.'
            : 'Sin ventas registradas. Las ventas las registra el dueño.'}
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th className="num">Cabezas</th>
                <th className="num">Peso salida</th>
                <th className="num">$/kg</th>
                <th className="num">Recibido</th>
                <th>Comprador</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lote.ventas.map((v) => {
                const animal = v.animalId ? lote.animales.find((a) => a.id === v.animalId) : null;
                return (
                  <tr key={v.id}>
                    <td>
                      {fmtDate(v.fecha)}
                      {v.animalId && (
                        <div className="kpi-sub">
                          {animal?.identificador ?? 'animal individual'}
                        </div>
                      )}
                    </td>
                    <td className="num">{v.cantidad}</td>
                    <td className="num">{v.pesoTotal === null ? <span className="muted">—</span> : `${fmtNum(v.pesoTotal)} kg`}</td>
                    <td className="num tabnum">{fmtPrecioKg(precioPorKg(v))}</td>
                    <td className="num">
                      <strong>{fmtMoney(v.valorRecibido)}</strong>
                      {Number(v.deduccion) > 0 && (
                        <div className="kpi-sub tabnum">
                          {fmtMoney(v.valorTotal)} − {fmtMoney(v.deduccion)}
                        </div>
                      )}
                    </td>
                    <td>
                      {v.comprador ?? <span className="muted">—</span>}
                      {v.notas && <div className="kpi-sub">{v.notas}</div>}
                    </td>
                    <td>
                      {esDueno && (
                        <button
                          type="button"
                          className="btn-danger btn-icon btn-sm"
                          onClick={() => onDelete(v)}
                          aria-label="Eliminar venta"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// Un solo formulario para las dos puertas: vender del lote (elegís cuántas
// cabezas) o vender un animal registrado individualmente (es siempre una, la suya).
function VentaForm({
  loteId, maxCabezas, animal, onDone, onCancel,
}: {
  loteId: string;
  maxCabezas: number;
  animal?: Animal;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [fecha, setFecha] = useState(() => toInputDate(new Date().toISOString()));
  const [cantidad, setCantidad] = useState(animal ? '1' : '1');
  const [pesoTotal, setPesoTotal] = useState(animal?.peso ? String(Number(animal.peso)) : '');
  const [valorTotal, setValorTotal] = useState('');
  const [deduccion, setDeduccion] = useState('');
  const [comprador, setComprador] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const bruto = Number(valorTotal) || 0;
  const desc = Number(deduccion) || 0;
  const recibido = bruto - desc;
  const kg = Number(pesoTotal) || 0;
  const precioKg = kg > 0 && bruto > 0 ? bruto / kg : null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (recibido < 0) {
      setError('La deducción no puede ser mayor que el valor de la venta');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api('/api/ventas', {
        method: 'POST',
        body: {
          loteId,
          animalId: animal?.id ?? null,
          fecha,
          cantidad: animal ? 1 : Number(cantidad),
          pesoTotal: pesoTotal === '' ? null : Number(pesoTotal),
          valorTotal: bruto,
          deduccion: desc,
          valorRecibido: recibido,
          comprador: comprador || null,
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
          <label htmlFor="venta-fecha">Fecha de la venta</label>
          <input id="venta-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="venta-cantidad">Cabezas</label>
          {animal ? (
            <input id="venta-cantidad" type="number" value={1} disabled />
          ) : (
            <input
              id="venta-cantidad"
              type="number"
              min={1}
              max={maxCabezas}
              step={1}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              required
            />
          )}
          <div className="helper">
            {animal ? 'La venta de un animal individual es una cabeza' : `Disponibles: ${maxCabezas}`}
          </div>
        </div>
        <div className="field">
          <label htmlFor="venta-peso">Peso de salida (kg)</label>
          <input
            id="venta-peso"
            type="number"
            step="0.01"
            min={0}
            value={pesoTotal}
            onChange={(e) => setPesoTotal(e.target.value)}
            placeholder="opcional"
          />
          <div className="helper">Dejalo vacío si vendiste por cabeza, sin báscula</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="venta-valor">Valor de la venta ($)</label>
          <input
            id="venta-valor"
            type="number"
            step="0.01"
            min={0}
            value={valorTotal}
            onChange={(e) => setValorTotal(e.target.value)}
            required
            placeholder="ej. 3200000"
          />
        </div>
        <div className="field">
          <label htmlFor="venta-deduccion">Deducción ($)</label>
          <input
            id="venta-deduccion"
            type="number"
            step="0.01"
            min={0}
            value={deduccion}
            onChange={(e) => setDeduccion(e.target.value)}
            placeholder="comisión, báscula… (opcional)"
          />
        </div>
      </div>

      <div className="callout row-between" style={{ marginBottom: 'var(--space-3)' }}>
        <span>Te queda</span>
        <strong className="tabnum" style={{ color: recibido < 0 ? 'var(--color-danger)' : 'var(--color-primary)' }}>
          {fmtMoney(recibido)}
          {precioKg !== null && <span className="muted" style={{ fontWeight: 400 }}> · {fmtPrecioKg(precioKg)}</span>}
        </strong>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="venta-comprador">Comprador (opcional)</label>
          <input id="venta-comprador" type="text" value={comprador} onChange={(e) => setComprador(e.target.value)} placeholder="ej. Feria de Montería" />
        </div>
        <div className="field">
          <label htmlFor="venta-notas">Nota (opcional)</label>
          <input id="venta-notas" type="text" value={notas} onChange={(e) => setNotas(e.target.value)} />
        </div>
      </div>

      {error && (
        <div className="error" role="alert">
          <AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} /> {error}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
        )}
        <button type="submit" disabled={loading}>
          <Banknote size={16} aria-hidden="true" />
          {loading ? 'Guardando…' : 'Registrar venta'}
        </button>
      </div>
    </form>
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
              <a href={f.url} target="_blank" rel="noreferrer">
                <img src={f.url} alt={`Foto del lote ${lote.loteNumero ?? ''}`} loading="lazy" />
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

function SeccionAnimales({
  lote, esDueno, onChange, ask,
}: { lote: LoteDetalle; esDueno: boolean; onChange: () => void; ask: Asker }) {
  const [showForm, setShowForm] = useState(false);
  const { enFinca } = resumenVentas(lote, lote.ventas, lote.gastos);
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
                <AnimalRow
                  key={a.id}
                  animal={a}
                  loteId={lote.id}
                  esDueno={esDueno}
                  venta={lote.ventas.find((v) => v.animalId === a.id) ?? null}
                  disponibles={enFinca}
                  onChange={onChange}
                  ask={ask}
                />
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

function AnimalRow({
  animal, loteId, esDueno, venta, disponibles, onChange, ask,
}: {
  animal: Animal;
  loteId: string;
  esDueno: boolean;
  venta: Venta | null;
  disponibles: number;
  onChange: () => void;
  ask: Asker;
}) {
  const [uploading, setUploading] = useState(false);
  const [vendiendo, setVendiendo] = useState(false);
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
        <td>
          {animal.identificador ?? <span className="muted">—</span>}
          {venta && (
            <div className="row" style={{ gap: 4, marginTop: 2 }}>
              <span className="badge" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
                <CheckCircle2 size={11} aria-hidden="true" /> Vendido
              </span>
              <span className="kpi-sub">{fmtDate(venta.fecha)} · {fmtMoney(venta.valorRecibido)}</span>
            </div>
          )}
        </td>
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
              <img key={f.id} className="thumb" src={f.url} alt="" />
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
          <div className="row" style={{ gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
            {esDueno && !venta && disponibles > 0 && (
              <button
                type="button"
                className={vendiendo ? 'btn-ghost btn-sm' : 'btn-secondary btn-sm'}
                onClick={() => setVendiendo((v) => !v)}
              >
                {vendiendo ? <><X size={12} aria-hidden="true" />Cancelar</> : <><Banknote size={12} aria-hidden="true" />Vender</>}
              </button>
            )}
            <button
              type="button"
              className="btn-danger btn-icon btn-sm"
              onClick={onDelete}
              aria-label="Eliminar animal"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>
      <tr>
        <td colSpan={6} style={{ paddingTop: 0 }}>
          {vendiendo && (
            <VentaForm
              loteId={loteId}
              animal={animal}
              maxCabezas={disponibles}
              onDone={() => { setVendiendo(false); onChange(); }}
              onCancel={() => setVendiendo(false)}
            />
          )}
          <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <Anotaciones
              compact
              target={{ animalId: animal.id }}
              anotaciones={anotaciones}
              onChange={onChange}
            />
            {animal.sexo === 'VP' && (
              <PrenezControl
                animalId={animal.id}
                prenez={animal.prenez ?? []}
                onChange={onChange}
              />
            )}
          </div>
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
