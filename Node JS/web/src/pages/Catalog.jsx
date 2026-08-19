import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function Catalog() {
  const [widgets, setWidgets] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .widgets(q ? { q } : {})
      .then(setWidgets)
      .catch((err) => setError(err.message));
  }, [q]);

  return (
    <div>
      <div className="page-header">
        <h1>Widgets</h1>
        <input
          className="search-input"
          placeholder="Search widgets..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {error && <p className="error">{error}</p>}
      {widgets.length === 0 && !error ? (
        <div className="empty-state">No widgets found.</div>
      ) : (
        <div className="widget-grid">
          {widgets.map((w) => (
            <div key={w.id} className="widget-card">
              <div className="widget-thumb">{w.name.slice(0, 1).toUpperCase()}</div>
              <div className="widget-card-body">
                <h3>
                  <Link to={`/widgets/${w.id}`}>{w.name}</Link>
                </h3>
                <div className="widget-price">${(w.price_cents / 100).toFixed(2)}</div>
                <span className={`badge ${w.stock_quantity > 0 ? 'in-stock' : 'out-of-stock'}`}>
                  {w.stock_quantity > 0 ? `${w.stock_quantity} in stock` : 'Out of stock'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
