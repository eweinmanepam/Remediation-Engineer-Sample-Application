import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function Admin() {
  const [widgets, setWidgets] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({ sku: '', name: '', description: '', price_cents: '', stock_quantity: '' });
  const [error, setError] = useState('');

  function refresh() {
    api.widgets().then(setWidgets);
    api.adminOrders().then(setOrders).catch((err) => setError(err.message));
  }

  useEffect(refresh, []);

  async function createWidget(e) {
    e.preventDefault();
    setError('');
    try {
      await api.adminCreateWidget({
        ...form,
        price_cents: Number(form.price_cents),
        stock_quantity: Number(form.stock_quantity || 0),
      });
      setForm({ sku: '', name: '', description: '', price_cents: '', stock_quantity: '' });
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updatePrice(widget) {
    const priceStr = window.prompt(`New price for ${widget.name} (USD)`, (widget.price_cents / 100).toFixed(2));
    if (priceStr == null) return;
    const price_cents = Math.round(Number(priceStr) * 100);
    if (!Number.isInteger(price_cents) || price_cents < 0) return;
    try {
      await api.adminUpdateWidget(widget.id, { price_cents });
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Admin console</h1>
      </div>
      {error && <p className="error">{error}</p>}

      <h2>Add widget</h2>
      <div className="card" style={{ maxWidth: 480 }}>
        <form onSubmit={createWidget}>
          <input placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <input
            placeholder="Price (cents)"
            value={form.price_cents}
            onChange={(e) => setForm({ ...form, price_cents: e.target.value })}
            required
          />
          <input
            placeholder="Stock quantity"
            value={form.stock_quantity}
            onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
          />
          <button type="submit">Create widget</button>
        </form>
      </div>

      <h2>Catalog</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Price</th>
              <th>Stock</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {widgets.map((w) => (
              <tr key={w.id}>
                <td>{w.name}</td>
                <td>${(w.price_cents / 100).toFixed(2)}</td>
                <td>{w.stock_quantity}</td>
                <td>
                  <button className="secondary" onClick={() => updatePrice(w)}>
                    Set price
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>All orders (read-only)</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Status</th>
              <th>Total</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
