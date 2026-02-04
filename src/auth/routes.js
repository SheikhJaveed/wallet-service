const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  // Verify user exists
  const result = await pool.query(
    `SELECT id FROM accounts WHERE user_id=$1 AND account_type='user'`,
    [user_id]
  );

  if (!result.rowCount) {
    return res.status(401).json({ error: 'Invalid user' });
  }

  const account_id = result.rows[0].id;

  // Issue JWT
  const token = jwt.sign(
    {
      sub: user_id,
      account_id,
      role: 'user'
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.json({ token });
});

module.exports = router;
