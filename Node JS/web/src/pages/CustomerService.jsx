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
      <h1>Customer Service</h1>
      {error && <p className="error">{error}</p>}

      <h2>Find orders</h2>
      <input placeholder="Customer email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button onClick={search}>Search</button>
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
              <td>{o.status}</td>
              <td>${(o.total_cents / 100).toFixed(2)}</td>
              <td>
                <button onClick={() => openOrder(o.id)}>View</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <div>
          <h2>Order #{selected.id}</h2>
          <p>Status: {selected.status}</p>
          <p>Total: ${(selected.total_cents / 100).toFixed(2)}</p>

          <h3>Issue refund</h3>
          <input placeholder="Amount (USD)" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
          <input placeholder="Reason" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
          <button onClick={issueRefund}>Refund</button>

          <h3>Refund history</h3>
          <ul>
            {(selected.refunds || []).map((r) => (
              <li key={r.id}>
                ${(r.amount_cents / 100).toFixed(2)} — {r.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
