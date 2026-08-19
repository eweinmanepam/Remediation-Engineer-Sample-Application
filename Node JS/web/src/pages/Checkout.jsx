import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, tokenizeCard } from '../api/client';

export default function Checkout() {
  const navigate = useNavigate();
  const [cart, setCart] = useState({ items: [], subtotal_cents: 0 });
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState('');
  const [newAddress, setNewAddress] = useState({ line1: '', city: '', state: '', postal_code: '', country: 'US' });
  const [card, setCard] = useState({ card_number: '', exp_month: '', exp_year: '', cvv: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.cart().then(setCart).catch((err) => setError(err.message));
    api.addresses().then((rows) => {
      setAddresses(rows);
      if (rows.length > 0) setAddressId(String(rows[0].id));
    });
  }, []);

  async function saveAddress() {
    try {
      const created = await api.addAddress(newAddress);
      setAddresses((prev) => [...prev, created]);
      setAddressId(String(created.id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (!addressId) throw new Error('Please select or add a shipping address');
      const card_token = await tokenizeCard(card);
      const order = await api.checkout({ shipping_address_id: Number(addressId), card_token });
      navigate(`/orders`, { state: { justPlaced: order.id } });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>Checkout</h1>

      <div className="card" style={{ marginBottom: '1.5rem', maxWidth: 480 }}>
        <div className="cart-summary" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
          <span>Order subtotal</span>
          <span className="total">${(cart.subtotal_cents / 100).toFixed(2)}</span>
        </div>
      </div>

      <h2>Shipping address</h2>
      <div className="card" style={{ maxWidth: 480 }}>
        {addresses.length > 0 && (
          <select value={addressId} onChange={(e) => setAddressId(e.target.value)} style={{ marginBottom: '1rem' }}>
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.line1}, {a.city}
              </option>
            ))}
          </select>
        )}
        <details>
          <summary>Add a new address</summary>
          <form onSubmit={(e) => e.preventDefault()}>
            <input
              placeholder="Address line 1"
              value={newAddress.line1}
              onChange={(e) => setNewAddress({ ...newAddress, line1: e.target.value })}
            />
            <input placeholder="City" value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })} />
            <input
              placeholder="State"
              value={newAddress.state}
              onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
            />
            <input
              placeholder="Postal code"
              value={newAddress.postal_code}
              onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value })}
            />
            <input
              placeholder="Country"
              value={newAddress.country}
              onChange={(e) => setNewAddress({ ...newAddress, country: e.target.value })}
            />
            <button type="button" className="secondary" onClick={saveAddress}>
              Save address
            </button>
          </form>
        </details>
      </div>

      <h2>Payment</h2>
      <p className="helper-text" style={{ marginTop: '-0.5rem' }}>
        Processed by FauxPay — a fictional payment processor for this training environment. Use test card
        4242 4242 4242 4242.
      </p>
      <div className="card" style={{ maxWidth: 480 }}>
        <form onSubmit={submit}>
          <input
            placeholder="Card number"
            value={card.card_number}
            onChange={(e) => setCard({ ...card, card_number: e.target.value })}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              placeholder="MM"
              value={card.exp_month}
              onChange={(e) => setCard({ ...card, exp_month: e.target.value })}
              style={{ width: '4rem' }}
            />
            <input
              placeholder="YYYY"
              value={card.exp_year}
              onChange={(e) => setCard({ ...card, exp_year: e.target.value })}
              style={{ width: '5rem' }}
            />
            <input
              placeholder="CVV"
              value={card.cvv}
              onChange={(e) => setCard({ ...card, cvv: e.target.value })}
              style={{ width: '4.5rem' }}
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Placing order...' : `Pay $${(cart.subtotal_cents / 100).toFixed(2)}`}
          </button>
        </form>
      </div>
    </div>
  );
}
