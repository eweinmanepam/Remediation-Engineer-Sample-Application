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
    <div>
      <h1>{widget.name}</h1>
      <p>{widget.description}</p>
      <p>${(widget.price_cents / 100).toFixed(2)}</p>
      <p>{widget.stock_quantity} in stock</p>
      <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={{ width: '4rem' }} />
      <button onClick={addToCart}>Add to cart</button>
      {message && <p>{message}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
