import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.orders().then(setOrders).catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <h1>My Orders</h1>
      {error && <p className="error">{error}</p>}
      {orders.length === 0 && !error ? (
        <div className="empty-state">
          No orders yet. <Link to="/">Start shopping</Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Status</th>
                <th>Total</th>
                <th>Placed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>#{o.id}</td>
                  <td>
                    <span className={`status-pill ${o.status}`}>{o.status.replace(/_/g, ' ')}</span>
                  </td>
                  <td>${(o.total_cents / 100).toFixed(2)}</td>
                  <td>{new Date(o.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
