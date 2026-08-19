const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/auth');

const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(requireAuth);

async function getOrCreateCart(userId) {
  let cart = await db('carts').where({ user_id: userId }).first();
  if (!cart) {
    const [row] = await db('carts').insert({ user_id: userId }).returning('id');
    cart = { id: row.id ?? row, user_id: userId };
  }
  return cart;
}

async function serializeCart(cartId) {
  const items = await db('cart_items')
    .join('widgets', 'widgets.id', 'cart_items.widget_id')
    .where({ cart_id: cartId })
    .select(
      'cart_items.id as item_id',
      'widgets.id as widget_id',
      'widgets.name',
      'widgets.price_cents',
      'widgets.stock_quantity',
      'cart_items.quantity'
    );
  return { items, subtotal_cents: items.reduce((sum, i) => sum + i.price_cents * i.quantity, 0) };
}

router.get('/', asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user.sub);
  res.json(await serializeCart(cart.id));
}));

router.post('/items', asyncHandler(async (req, res) => {
  const { widget_id, quantity } = req.body || {};
  const qty = Number(quantity);
  if (!widget_id || !Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({ error: 'widget_id and a positive integer quantity are required' });
  }

  const widget = await db('widgets').where({ id: widget_id, is_active: true }).first();
  if (!widget) return res.status(404).json({ error: 'Widget not found' });

  const cart = await getOrCreateCart(req.user.sub);
  const existing = await db('cart_items').where({ cart_id: cart.id, widget_id }).first();
  if (existing) {
    await db('cart_items').where({ id: existing.id }).update({ quantity: existing.quantity + qty });
  } else {
    await db('cart_items').insert({ cart_id: cart.id, widget_id, quantity: qty });
  }
  res.status(201).json(await serializeCart(cart.id));
}));

router.patch('/items/:itemId', asyncHandler(async (req, res) => {
  const qty = Number(req.body?.quantity);
  if (!Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({ error: 'quantity must be a positive integer' });
  }
  const cart = await getOrCreateCart(req.user.sub);
  const updated = await db('cart_items').where({ id: req.params.itemId, cart_id: cart.id }).update({ quantity: qty });
  if (!updated) return res.status(404).json({ error: 'Cart item not found' });
  res.json(await serializeCart(cart.id));
}));

router.delete('/items/:itemId', asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user.sub);
  await db('cart_items').where({ id: req.params.itemId, cart_id: cart.id }).del();
  res.json(await serializeCart(cart.id));
}));

module.exports = router;
