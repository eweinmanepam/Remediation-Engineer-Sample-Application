import { useEffect, useState } from 'react';
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
              <td>{o.status}</td>
              <td>${(o.total_cents / 100).toFixed(2)}</td>
              <td>{new Date(o.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
