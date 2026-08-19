const express = require('express');
const db = require('../db/connection');
const { requireAuth, requireRole } = require('../middleware/auth');
const fauxpay = require('../services/fauxpayClient');

const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(requireAuth, requireRole('customer_service'));

router.get('/orders', asyncHandler(async (req, res) => {
  const { email } = req.query;
  let query = db('orders').join('users', 'users.id', 'orders.user_id').select('orders.*', 'users.email as customer_email');
  if (email) query = query.andWhereILike('users.email', `%${email}%`);
  res.json(await query.orderBy('orders.created_at', 'desc'));
}));

router.get('/orders/:id', asyncHandler(async (req, res) => {
  const order = await db('orders').where({ id: req.params.id }).first();
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const items = await db('order_items').where({ order_id: order.id });
  const refunds = await db('refunds').where({ order_id: order.id });
  const exchanges = await db('exchanges').where({ order_id: order.id });
  res.json({ ...order, items, refunds, exchanges });
}));

router.post('/orders/:id/refunds', asyncHandler(async (req, res) => {
  const { amount_cents, reason } = req.body || {};
  if (!Number.isInteger(amount_cents) || amount_cents < 1) {
    return res.status(400).json({ error: 'amount_cents must be a positive integer' });
  }

  const order = await db('orders').where({ id: req.params.id }).first();
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const payment = await db('payments').where({ id: order.payment_id }).first();
  if (!payment) return res.status(400).json({ error: 'Order has no associated payment' });

  const alreadyRefunded = await db('refunds').where({ order_id: order.id }).sum('amount_cents as total').first();
  const refundedSoFar = Number(alreadyRefunded.total || 0);
  if (refundedSoFar + amount_cents > order.total_cents) {
    return res.status(400).json({ error: 'Refund amount exceeds order total' });
  }

  let result;
  try {
    result = await fauxpay.refund({ transactionId: payment.processor_transaction_id, amountCents: amount_cents });
  } catch (err) {
    return res.status(502).json({ error: 'Refund failed at processor', detail: err.data?.error });
  }

  const [row] = await db('refunds')
    .insert({
      order_id: order.id,
      payment_id: payment.id,
      issued_by: req.user.sub,
      amount_cents,
      reason,
      processor_refund_id: result.refund_id,
    })
    .returning('id');

  const totalRefunded = refundedSoFar + amount_cents;
  const newOrderStatus = totalRefunded >= order.total_cents ? 'refunded' : 'partially_refunded';
  const newPaymentStatus = totalRefunded >= payment.amount_cents ? 'refunded' : 'partially_refunded';
  await db('orders').where({ id: order.id }).update({ status: newOrderStatus });
  await db('payments').where({ id: payment.id }).update({ status: newPaymentStatus });

  res.status(201).json(await db('refunds').where({ id: row.id ?? row }).first());
}));

router.post('/orders/:id/exchanges', asyncHandler(async (req, res) => {
  const { returned_widget_id, returned_quantity, replacement_widget_id, replacement_quantity, notes } = req.body || {};
  const order = await db('orders').where({ id: req.params.id }).first();
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const [row] = await db('exchanges')
    .insert({
      order_id: order.id,
      processed_by: req.user.sub,
      returned_widget_id,
      returned_quantity,
      replacement_widget_id,
      replacement_quantity,
      status: 'requested',
      notes,
    })
    .returning('id');

  await db('orders').where({ id: order.id }).update({ status: 'exchange_pending' });
  res.status(201).json(await db('exchanges').where({ id: row.id ?? row }).first());
}));

router.patch('/exchanges/:id', asyncHandler(async (req, res) => {
  const { status, notes } = req.body || {};
  if (status && !['requested', 'received', 'completed', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const exchange = await db('exchanges').where({ id: req.params.id }).first();
  if (!exchange) return res.status(404).json({ error: 'Exchange not found' });

  const updates = { updated_at: db.fn.now() };
  if (status) updates.status = status;
  if (notes !== undefined) updates.notes = notes;
  await db('exchanges').where({ id: req.params.id }).update(updates);

  if (status === 'completed') {
    await db('orders').where({ id: exchange.order_id }).update({ status: 'exchanged' });
  } else if (status === 'rejected') {
    await db('orders').where({ id: exchange.order_id }).update({ status: 'paid' });
  }

  res.json(await db('exchanges').where({ id: req.params.id }).first());
}));

module.exports = router;
