import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function Cart() {
  const [cart, setCart] = useState({ items: [], subtotal_cents: 0 });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  function refresh() {
    api.cart().then(setCart).catch((err) => setError(err.message));
  }

  useEffect(refresh, []);

  async function updateQty(itemId, quantity) {
    if (quantity < 1) return;
    try {
      setCart(await api.updateCartItem(itemId, quantity));
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(itemId) {
    try {
      setCart(await api.removeCartItem(itemId));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>Cart</h1>
      {error && <p className="error">{error}</p>}
      {cart.items.length === 0 && <p>Your cart is empty.</p>}
      {cart.items.map((item) => (
        <div key={item.item_id} className="cart-row">
          <span>
            {item.name} — ${(item.price_cents / 100).toFixed(2)} x{' '}
            <input
              type="number"
              min="1"
              value={item.quantity}
              onChange={(e) => updateQty(item.item_id, Number(e.target.value))}
              style={{ width: '4rem' }}
            />
          </span>
          <button onClick={() => remove(item.item_id)}>Remove</button>
        </div>
      ))}
      <p>
        <strong>Subtotal: ${(cart.subtotal_cents / 100).toFixed(2)}</strong>
      </p>
      {cart.items.length > 0 && <button onClick={() => navigate('/checkout')}>Checkout</button>}
      <p>
        <Link to="/">Continue shopping</Link>
      </p>
    </div>
  );
}
