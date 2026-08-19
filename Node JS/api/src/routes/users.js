const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/auth');

const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(requireAuth);

router.get('/me', asyncHandler(async (req, res) => {
  const user = await db('users').where({ id: req.user.sub }).select('id', 'email', 'full_name', 'role').first();
  res.json(user);
}));

router.get('/me/addresses', asyncHandler(async (req, res) => {
  res.json(await db('addresses').where({ user_id: req.user.sub }));
}));

router.post('/me/addresses', asyncHandler(async (req, res) => {
  const { line1, line2, city, state, postal_code, country, is_default_shipping, is_default_billing } = req.body || {};
  if (!line1 || !city || !postal_code || !country) {
    return res.status(400).json({ error: 'line1, city, postal_code, and country are required' });
  }
  const [row] = await db('addresses')
    .insert({
      user_id: req.user.sub,
      line1,
      line2,
      city,
      state,
      postal_code,
      country,
      is_default_shipping: !!is_default_shipping,
      is_default_billing: !!is_default_billing,
    })
    .returning('id');
  res.status(201).json(await db('addresses').where({ id: row.id ?? row }).first());
}));

module.exports = router;
