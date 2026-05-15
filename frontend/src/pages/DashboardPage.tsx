import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Lote } from '../types';
import { SEXO_SHORT } from '../types';
import { fmtDate, fmtMoney, fmtNum } from '../lib/format';

export function DashboardPage() {
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
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Mis lotes</h1>
        <Link to="/lotes/nuevo" className="btn">+ Nuevo lote</Link>
      </div>

      {loading ? (
        <p>Cargando…</p>
      ) : error ? (
        <div className="error">{error}</div>
      ) : lotes.length === 0 ? (
        <div className="card">
          <p className="muted">Aún no has registrado lotes.</p>
          <Link to="/lotes/nuevo" className="btn">Crear el primero</Link>
        </div>
      ) : (
        <>
          <div className="grid-3" style={{ marginBottom: '1rem' }}>
            <div className="card">
              <div className="muted">Cantidad total</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{totales.cantidad}</div>
            </div>
            <div className="card">
              <div className="muted">Peso total</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{fmtNum(totales.pesoTotal)} kg</div>
            </div>
            <div className="card">
              <div className="muted">Valor a pagar</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{fmtMoney(totales.valorAPagar)}</div>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Feria</th>
                  <th>Lote</th>
                  <th>Sexo</th>
                  <th>Cant.</th>
                  <th>Peso total</th>
                  <th>Valor total</th>
                  <th>A pagar</th>
                  <th>Referencia</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lotes.map((l) => (
                  <tr key={l.id}>
                    <td>{fmtDate(l.fecha)}</td>
                    <td>{l.numeroFeria ?? '—'}</td>
                    <td>{l.loteNumero ?? '—'}</td>
                    <td><span className="badge">{SEXO_SHORT[l.sexo]}</span></td>
                    <td>{l.cantidad}</td>
                    <td>{fmtNum(l.pesoTotal)}</td>
                    <td>{fmtMoney(l.valorTotal)}</td>
                    <td>{fmtMoney(l.valorAPagar)}</td>
                    <td>{l.referencia ?? '—'}</td>
                    <td>
                      <Link to={`/lotes/${l.id}`}>Abrir</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
