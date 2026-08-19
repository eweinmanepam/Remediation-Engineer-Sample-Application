import { useState } from 'react';
import { api } from '../api/client';

export default function CustomerService() {
  const [email, setEmail] = useState('');
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [error, setError] = useState('');

  async function search() {
    setError('');
    try {
      setOrders(await api.csOrders(email));
    } catch (err) {
      setError(err.message);
    }
  }

  async function openOrder(id) {
    setError('');
    try {
      setSelected(await api.csOrder(id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function issueRefund() {
    setError('');
    try {
      const amount_cents = Math.round(Number(refundAmount) * 100);
      await api.csRefund(selected.id, { amount_cents, reason: refundReason });
      await openOrder(selected.id);
      setRefundAmount('');
      setRefundReason('');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Customer Service</h1>
      </div>
      {error && <p className="error">{error}</p>}

      <h2>Find orders</h2>
      <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', maxWidth: 480 }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="cs-email">Customer email</label>
          <input id="cs-email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button onClick={search}>Search</button>
      </div>

      {orders.length > 0 && (
        <div className="table-wrap" style={{ marginTop: '1.25rem' }}>
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>#{o.id}</td>
                  <td>{o.customer_email}</td>
                  <td>
                    <span className={`status-pill ${o.status}`}>{o.status.replace(/_/g, ' ')}</span>
                  </td>
                  <td>${(o.total_cents / 100).toFixed(2)}</td>
                  <td>
                    <button className="secondary" onClick={() => openOrder(o.id)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <>
          <hr className="section-divider" />
          <h2>Order #{selected.id}</h2>
          <div className="card" style={{ maxWidth: 480 }}>
            <p>
              Status: <span className={`status-pill ${selected.status}`}>{selected.status.replace(/_/g, ' ')}</span>
            </p>
            <p className="widget-price">${(selected.total_cents / 100).toFixed(2)}</p>

            <h3>Issue refund</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <input placeholder="Amount (USD)" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
              <input placeholder="Reason" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
              <button onClick={issueRefund}>Issue refund</button>
            </div>

            <h3 style={{ marginTop: '1.5rem' }}>Refund history</h3>
            {(selected.refunds || []).length === 0 ? (
              <p className="helper-text">No refunds issued yet.</p>
            ) : (
              <ul style={{ paddingLeft: '1.1rem', margin: 0 }}>
                {selected.refunds.map((r) => (
                  <li key={r.id}>
                    ${(r.amount_cents / 100).toFixed(2)} — {r.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
