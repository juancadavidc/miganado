import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Beef, Scale, Wallet, Banknote, TrendingUp, HandCoins, ArrowRight, PackageOpen, AlertCircle, Upload } from 'lucide-react';
import { api } from '../api/client';
import type { Lote, TipoGasto } from '../types';
import { TIPO_GASTO_LABELS } from '../types';
import { fmtDate, fmtMoney, fmtNum } from '../lib/format';
import { SexoBadge } from '../components/SexoBadge';
import { useAuth } from '../auth/AuthContext';
import { utilidadVendido } from '../lib/ventas';

// Lo comprado no cambia al vender; lo que baja son las cabezas que quedan cebándose.
function enFinca(lote: Lote): number {
  return Math.max(0, lote.cantidad - (lote.cantidadVendida ?? 0));
}

// A cómo se compró el kilo: el valor final de la feria, o total ÷ peso si no vino.
function precioKgCompra(lote: Lote): number | null {
  const final = Number(lote.valorFinal);
  if (final > 0) return final;
  const peso = Number(lote.pesoTotal);
  return peso > 0 ? Number(lote.valorTotal) / peso : null;
}

function CantidadCabezas({ lote, unidad = '' }: { lote: Lote; unidad?: string }) {
  const quedan = enFinca(lote);
  if (quedan === lote.cantidad) return <>{lote.cantidad}{unidad}</>;
  if (quedan === 0) {
    return (
      <span className="badge" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
        Vendido
      </span>
    );
  }
  return (
    <>
      {quedan}{unidad}
      <span className="muted" style={{ marginLeft: 4, fontSize: '0.7rem' }} title={`${lote.cantidadVendida} vendidas de ${lote.cantidad}`}>
        de {lote.cantidad}
      </span>
    </>
  );
}

function RolTag({ lote, meId }: { lote: Lote; meId?: string }) {
  const finca = lote.finca;
  if (!meId || !finca?.dueno) return null;
  const soyDueno = finca.dueno.id === meId;
  if (!soyDueno) {
    return (
      <span className="badge" style={{ marginLeft: 6, background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}>
        Cuido
      </span>
    );
  }
  if (finca.cuidador && finca.cuidador.id !== finca.dueno.id) {
    return (
      <span className="badge" style={{ marginLeft: 6 }} title={`Cuida: ${finca.cuidador.nombre}`}>
        Cuida: {finca.cuidador.nombre.split(/\s+/)[0]}
      </span>
    );
  }
  return null;
}

export function DashboardPage() {
  const { user } = useAuth();
  const meId = user?.id;
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ lotes: Lote[] }>('/api/lotes')
      .then((d) => setLotes(d.lotes))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const totales = lotes.reduce(
    (acc, l) => {
      acc.cantidad += enFinca(l);
      acc.pesoTotal += Number(l.pesoTotal);
      acc.valorTotal += Number(l.valorTotal);
      // Solo lo que queda en finca: la compra se prorratea por las cabezas que no se han vendido.
      if (l.cantidad > 0) acc.valorAPagar += (Number(l.valorAPagar) * enFinca(l)) / l.cantidad;
      acc.vendido += l.ingresosVentas ?? 0;
      acc.cabezasVendidas += Math.min(l.cantidadVendida ?? 0, l.cantidad);
      acc.utilidad += utilidadVendido(l);
      if ((l.cantidadVendida ?? 0) > 0) acc.lotesConVentas += 1;
      for (const [tipo, monto] of Object.entries(l.gastosPendiente ?? {})) {
        acc.pendientePorTipo[tipo as TipoGasto] = (acc.pendientePorTipo[tipo as TipoGasto] ?? 0) + monto;
        acc.pendiente += monto;
      }
      return acc;
    },
    {
      cantidad: 0, pesoTotal: 0, valorTotal: 0, valorAPagar: 0, vendido: 0, cabezasVendidas: 0, utilidad: 0, lotesConVentas: 0,
      pendiente: 0, pendientePorTipo: {} as Partial<Record<TipoGasto, number>>,
    },
  );
  // Quién te cobra, de mayor a menor: "Comisión cuidador $1.200.000 · Vacunas $80.000".
  const desglosePendiente = Object.entries(totales.pendientePorTipo)
    .sort(([, a], [, b]) => b - a)
    .map(([tipo, monto]) => `${TIPO_GASTO_LABELS[tipo as TipoGasto]} ${fmtMoney(monto)}`)
    .join(' · ');

  return (
    <div className="container">
      <header className="page-header">
        <div>
          <h1>Mis lotes</h1>
          <p className="subtitle">Lotes comprados en la feria comercial</p>
        </div>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <Link to="/lotes/importar" className="btn-secondary">
            <Upload size={16} aria-hidden="true" />
            Importar planilla
          </Link>
          <Link to="/lotes/nuevo" className="btn">
            <Plus size={16} aria-hidden="true" />
            Nuevo lote
          </Link>
        </div>
      </header>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <div className="error" role="alert">
          <AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
          {error}
        </div>
      ) : lotes.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <section className="kpi-grid" style={{ marginBottom: 'var(--space-4)' }}>
            <KpiCard icon={<Beef size={16} />} label="Cabezas en finca" value={String(totales.cantidad)} />
            <KpiCard icon={<Scale size={16} />} label="Peso total" value={`${fmtNum(totales.pesoTotal)}`} suffix="kg" />
            <KpiCard icon={<Wallet size={16} />} label="Valor a pagar" value={fmtMoney(totales.valorAPagar)} sub="de lo que queda en finca" />
            <KpiCard
              icon={<Banknote size={16} />}
              label="Vendido"
              value={fmtMoney(totales.vendido)}
              sub={
                totales.cabezasVendidas === 0
                  ? 'aún sin ventas'
                  : `${totales.cabezasVendidas} ${totales.cabezasVendidas === 1 ? 'cabeza vendida' : 'cabezas vendidas'}`
              }
            />
            <KpiCard
              icon={<TrendingUp size={16} />}
              label="Utilidad"
              value={fmtMoney(totales.utilidad)}
              color={totales.lotesConVentas === 0 ? undefined : totales.utilidad >= 0 ? 'var(--color-primary)' : 'var(--color-danger)'}
              sub={
                totales.lotesConVentas === 0
                  ? 'aún sin ventas'
                  : `de ${totales.lotesConVentas} ${totales.lotesConVentas === 1 ? 'lote vendido' : 'lotes con ventas'}`
              }
            />
            {totales.pendiente > 0 && (
              <KpiCard
                icon={<HandCoins size={16} />}
                label="Por pagar"
                value={fmtMoney(totales.pendiente)}
                color="var(--color-danger)"
                sub={desglosePendiente}
              />
            )}
          </section>

          <section className="card card-pad-0 hide-mobile">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Feria</th>
                  <th>Lote</th>
                  <th>Sexo</th>
                  <th className="num">Cant.</th>
                  <th className="num">Peso (kg)</th>
                  <th className="num">$/kg</th>
                  <th className="num">Valor total</th>
                  <th className="num">A pagar</th>
                  <th>Referencia</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lotes.map((l) => (
                  <tr key={l.id}>
                    <td>{fmtDate(l.fecha)}</td>
                    <td>{l.numeroFeria ?? '—'}</td>
                    <td>{l.loteNumero ?? '—'}<RolTag lote={l} meId={meId} /></td>
                    <td><SexoBadge sexo={l.sexo} /></td>
                    <td className="num"><CantidadCabezas lote={l} /></td>
                    <td className="num">{fmtNum(l.pesoTotal)}</td>
                    <td className="num">{fmtMoney(precioKgCompra(l))}</td>
                    <td className="num">{fmtMoney(l.valorTotal)}</td>
                    <td className="num"><strong>{fmtMoney(l.valorAPagar)}</strong></td>
                    <td>{l.referencia ?? '—'}</td>
                    <td>
                      <Link to={`/lotes/${l.id}`} aria-label={`Abrir lote ${l.loteNumero ?? l.id.slice(0, 6)}`}>
                        <ArrowRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="stack show-mobile">
            {lotes.map((l) => (
              <Link key={l.id} to={`/lotes/${l.id}`} className="lote-card">
                <div className="lote-card-head">
                  <div>
                    <div style={{ fontWeight: 700 }}>{fmtDate(l.fecha)}</div>
                    <div className="muted" style={{ fontSize: '0.8rem' }}>
                      Feria {l.numeroFeria ?? '—'} · Lote {l.loteNumero ?? '—'}
                      <RolTag lote={l} meId={meId} />
                    </div>
                  </div>
                  <SexoBadge sexo={l.sexo} />
                </div>
                <dl className="lote-card-body">
                  <div>
                    <dt>En finca</dt>
                    <dd><CantidadCabezas lote={l} unidad=" cab." /></dd>
                  </div>
                  <div>
                    <dt>Peso</dt>
                    <dd>{fmtNum(l.pesoTotal)} kg</dd>
                  </div>
                  <div>
                    <dt>$/kg</dt>
                    <dd>{fmtMoney(precioKgCompra(l))}</dd>
                  </div>
                  <div>
                    <dt>Valor</dt>
                    <dd>{fmtMoney(l.valorTotal)}</dd>
                  </div>
                  <div>
                    <dt>A pagar</dt>
                    <dd style={{ color: 'var(--color-primary)' }}>{fmtMoney(l.valorAPagar)}</dd>
                  </div>
                </dl>
              </Link>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

function KpiCard({
  icon, label, value, suffix, color, sub,
}: { icon: React.ReactNode; label: string; value: string; suffix?: string; color?: string; sub?: string }) {
  return (
    <div className="card kpi">
      <div className="kpi-head">
        <span>{label}</span>
        <span className="ico">{icon}</span>
      </div>
      <div className="kpi-value" style={color ? { color } : undefined}>
        {value}
        {suffix && <span style={{ fontSize: '0.95rem', color: 'var(--color-text-muted)', fontWeight: 500, marginLeft: 4 }}>{suffix}</span>}
      </div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card empty-state">
      <span className="empty-icon"><PackageOpen size={28} /></span>
      <h2>Aún no has registrado lotes</h2>
      <p>Comienza registrando tu primera compra en la feria.</p>
      <Link to="/lotes/nuevo" className="btn">
        <Plus size={16} aria-hidden="true" />
        Crear el primero
      </Link>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="stack">
      <div className="grid-4">
        <div className="card" style={{ height: 96, background: 'var(--color-surface-2)' }} />
        <div className="card" style={{ height: 96, background: 'var(--color-surface-2)' }} />
        <div className="card" style={{ height: 96, background: 'var(--color-surface-2)' }} />
        <div className="card" style={{ height: 96, background: 'var(--color-surface-2)' }} />
      </div>
      <div className="card" style={{ height: 240, background: 'var(--color-surface-2)' }} />
    </div>
  );
}
