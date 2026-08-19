const FAUXPAY_BASE_URL = process.env.FAUXPAY_BASE_URL || 'http://fauxpay:4000';
const FAUXPAY_API_KEY = process.env.FAUXPAY_API_KEY;

async function post(path, body) {
  const res = await fetch(`${FAUXPAY_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${FAUXPAY_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'FauxPay request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function charge({ cardToken, amountCents, currency = 'USD', orderId }) {
  return post('/charge', { card_token: cardToken, amount_cents: amountCents, currency, order_id: orderId });
}

function refund({ transactionId, amountCents }) {
  return post('/refund', { transaction_id: transactionId, amount_cents: amountCents });
}

module.exports = { charge, refund };
