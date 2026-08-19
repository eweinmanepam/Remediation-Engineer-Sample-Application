const express = require('express');
const crypto = require('crypto');

const API_KEY = process.env.FAUXPAY_API_KEY || 'fauxpay_test_key';
const PORT = Number(process.env.PORT || 4000);

const app = express();
app.use(express.json());

// In-memory stores — FauxPay is a fictional processor for training/demo purposes only.
const tokens = new Map(); // card_token -> { last4, brand }
const transactions = new Map(); // transaction_id -> { amount_cents, refunded_cents }

function requireApiKey(req, res, next) {
  const header = req.headers.authorization || '';
  const key = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (key !== API_KEY) return res.status(401).json({ error: 'Invalid FauxPay API key' });
  next();
}

function detectBrand(cardNumber) {
  if (/^4/.test(cardNumber)) return 'visa';
  if (/^5[1-5]/.test(cardNumber)) return 'mastercard';
  return 'unknown';
}

// Called directly by the SPA — never routed through our own backend, so raw
// card data never touches our servers.
app.post('/tokenize', (req, res) => {
  const { card_number, exp_month, exp_year, cvv } = req.body || {};
  if (!card_number || !exp_month || !exp_year || !cvv) {
    return res.status(400).json({ error: 'card_number, exp_month, exp_year, and cvv are required' });
  }
  if (!/^\d{13,19}$/.test(card_number)) {
    return res.status(400).json({ error: 'Invalid card number' });
  }

  const token = `tok_${crypto.randomBytes(16).toString('hex')}`;
  tokens.set(token, { last4: card_number.slice(-4), brand: detectBrand(card_number) });
  res.status(201).json({ card_token: token });
});

app.post('/charge', requireApiKey, (req, res) => {
  const { card_token, amount_cents, order_id } = req.body || {};
  const card = tokens.get(card_token);
  if (!card) return res.status(400).json({ error: 'Unknown card_token' });
  if (!Number.isInteger(amount_cents) || amount_cents < 1) {
    return res.status(400).json({ error: 'amount_cents must be a positive integer' });
  }

  const transactionId = `txn_${crypto.randomBytes(16).toString('hex')}`;
  transactions.set(transactionId, { amount_cents, refunded_cents: 0, order_id });

  res.status(201).json({
    transaction_id: transactionId,
    status: 'captured',
    last4: card.last4,
    brand: card.brand,
  });
});

app.post('/refund', requireApiKey, (req, res) => {
  const { transaction_id, amount_cents } = req.body || {};
  const txn = transactions.get(transaction_id);
  if (!txn) return res.status(404).json({ error: 'Unknown transaction_id' });
  if (!Number.isInteger(amount_cents) || amount_cents < 1) {
    return res.status(400).json({ error: 'amount_cents must be a positive integer' });
  }
  if (txn.refunded_cents + amount_cents > txn.amount_cents) {
    return res.status(400).json({ error: 'Refund amount exceeds original charge' });
  }

  txn.refunded_cents += amount_cents;
  const refundId = `re_${crypto.randomBytes(16).toString('hex')}`;
  res.status(201).json({ refund_id: refundId, status: 'succeeded' });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`fauxpay listening on port ${PORT}`));
