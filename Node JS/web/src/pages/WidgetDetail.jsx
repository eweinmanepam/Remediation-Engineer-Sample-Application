import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../AuthContext';

export default function WidgetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [widget, setWidget] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api
      .widgets()
      .then((all) => setWidget(all.find((w) => String(w.id) === id) || null))
      .catch((err) => setError(err.message));
    // The list endpoint is reused here for simplicity; a dedicated
    // GET /api/widgets/:id call would work identically.
  }, [id]);

  async function addToCart() {
    if (!user) return navigate('/login');
    try {
      await api.addToCart(Number(id), Number(quantity));
      setMessage('Added to cart.');
    } catch (err) {
      setError(err.message);
    }
  }

  if (!widget) return <p>Loading...</p>;

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <div className="widget-thumb" style={{ height: 180, borderRadius: 'var(--radius-md)', fontSize: '3rem', marginBottom: '1.25rem' }}>
        {widget.name.slice(0, 1).toUpperCase()}
      </div>
      <h1>{widget.name}</h1>
      <p>{widget.description}</p>
      <p className="widget-price">${(widget.price_cents / 100).toFixed(2)}</p>
      <span className={`badge ${widget.stock_quantity > 0 ? 'in-stock' : 'out-of-stock'}`}>
        {widget.stock_quantity > 0 ? `${widget.stock_quantity} in stock` : 'Out of stock'}
      </span>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '1.25rem' }}>
        <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <button onClick={addToCart} disabled={widget.stock_quantity < 1}>
          Add to cart
        </button>
      </div>
      {message && <p className="helper-text" style={{ marginTop: '0.75rem' }}>{message}</p>}
      {error && <p className="error" style={{ marginTop: '0.75rem' }}>{error}</p>}
    </div>
  );
}
