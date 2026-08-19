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
      <h1>Your Cart</h1>
      {error && <p className="error">{error}</p>}

      <div className="card">
        {cart.items.length === 0 ? (
          <div className="empty-state">
            Your cart is empty. <Link to="/">Browse widgets</Link>
          </div>
        ) : (
          <>
            {cart.items.map((item) => (
              <div key={item.item_id} className="cart-row">
                <div>
                  <div className="cart-item-name">{item.name}</div>
                  <div className="cart-item-meta">${(item.price_cents / 100).toFixed(2)} each</div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateQty(item.item_id, Number(e.target.value))}
                  />
                  <span className="cart-item-name">${((item.price_cents * item.quantity) / 100).toFixed(2)}</span>
                  <button className="secondary" onClick={() => remove(item.item_id)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <div className="cart-summary">
              <span>Subtotal</span>
              <span className="total">${(cart.subtotal_cents / 100).toFixed(2)}</span>
            </div>
          </>
        )}
      </div>

      {cart.items.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
          <Link to="/">&larr; Continue shopping</Link>
          <button onClick={() => navigate('/checkout')}>Proceed to checkout</button>
        </div>
      )}
    </div>
  );
}
