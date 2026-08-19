const express = require('express');
const db = require('../db/connection');

const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.get('/widgets', asyncHandler(async (req, res) => {
  const { category_id, q } = req.query;
  let query = db('widgets').where({ is_active: true });
  if (category_id) query = query.andWhere({ category_id });
  if (q) query = query.andWhereILike('name', `%${q}%`);
  const widgets = await query.select('id', 'sku', 'name', 'description', 'price_cents', 'currency', 'stock_quantity', 'category_id', 'image_url');
  res.json(widgets);
}));

router.get('/widgets/:id', asyncHandler(async (req, res) => {
  const widget = await db('widgets').where({ id: req.params.id, is_active: true }).first();
  if (!widget) return res.status(404).json({ error: 'Widget not found' });
  res.json(widget);
}));

router.get('/categories', asyncHandler(async (req, res) => {
  const categories = await db('categories').select('id', 'name');
  res.json(categories);
}));

module.exports = router;
