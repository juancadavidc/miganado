import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Beef, Scale, Wallet, ArrowRight, PackageOpen, AlertCircle, Upload } from 'lucide-react';
import { api } from '../api/client';
import type { Lote } from '../types';
import { fmtDate, fmtMoney, fmtNum } from '../lib/format';
import { SexoBadge } from '../components/SexoBadge';
import { useAuth } from '../auth/AuthContext';

function RolTag({ lote, meId }: { lote: Lote; meId?: string }) {
  if (!meId || !lote.dueno) return null;
  const soyDueno = lote.dueno.id === meId;
  if (!soyDueno) {
    return (
      <span className="badge" style={{ marginLeft: 6, background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}>
        Cuido
      </span>
    );
  }
  if (lote.cuidador && lote.cuidador.id !== lote.dueno.id) {
    return (
      <span className="badge" style={{ marginLeft: 6 }} title={`Cuida: ${lote.cuidador.nombre}`}>
        Cuida: {lote.cuidador.nombre.split(/\s+/)[0]}
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
      acc.cantidad += l.cantidad;
      acc.pesoTotal += Number(l.pesoTotal);
      acc.valorTotal += Number(l.valorTotal);
      acc.valorAPagar += Number(l.valorAPagar);
      return acc;
    },
    { cantidad: 0, pesoTotal: 0, valorTotal: 0, valorAPagar: 0 },
  );

  return (
    <div className="container">
      <header className="page-header">
        <div>
          <h1>Mis lotes</h1>
          <p className="subtitle">Entregas registradas a la feria comercial</p>
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
          <section className="grid-3" style={{ marginBottom: 'var(--space-4)' }}>
            <KpiCard icon={<Beef size={16} />} label="Cabezas en total" value={String(totales.cantidad)} />
            <KpiCard icon={<Scale size={16} />} label="Peso total" value={`${fmtNum(totales.pesoTotal)}`} suffix="kg" />
            <KpiCard icon={<Wallet size={16} />} label="Valor a pagar" value={fmtMoney(totales.valorAPagar)} />
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
                    <td className="num">{l.cantidad}</td>
                    <td className="num">{fmtNum(l.pesoTotal)}</td>
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
                    <dt>Cantidad</dt>
                    <dd>{l.cantidad} cab.</dd>
                  </div>
                  <div>
                    <dt>Peso</dt>
                    <dd>{fmtNum(l.pesoTotal)} kg</dd>
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

function KpiCard({ icon, label, value, suffix }: { icon: React.ReactNode; label: string; value: string; suffix?: string }) {
  return (
    <div className="card kpi">
      <div className="kpi-head">
        <span>{label}</span>
        <span className="ico">{icon}</span>
      </div>
      <div className="kpi-value">
        {value}
        {suffix && <span style={{ fontSize: '0.95rem', color: 'var(--color-text-muted)', fontWeight: 500, marginLeft: 4 }}>{suffix}</span>}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card empty-state">
      <span className="empty-icon"><PackageOpen size={28} /></span>
      <h2>Aún no has registrado lotes</h2>
      <p>Comienza creando tu primera entrega a la feria.</p>
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
      <div className="grid-3">
        <div className="card" style={{ height: 96, background: 'var(--color-surface-2)' }} />
        <div className="card" style={{ height: 96, background: 'var(--color-surface-2)' }} />
        <div className="card" style={{ height: 96, background: 'var(--color-surface-2)' }} />
      </div>
      <div className="card" style={{ height: 240, background: 'var(--color-surface-2)' }} />
    </div>
  );
}
