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
      <h1>Widgets</h1>
      <input placeholder="Search widgets..." value={q} onChange={(e) => setQ(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <div className="widget-grid">
        {widgets.map((w) => (
          <div key={w.id} className="widget-card">
            <h3>
              <Link to={`/widgets/${w.id}`}>{w.name}</Link>
            </h3>
            <p>${(w.price_cents / 100).toFixed(2)}</p>
            <p>{w.stock_quantity > 0 ? `${w.stock_quantity} in stock` : 'Out of stock'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
