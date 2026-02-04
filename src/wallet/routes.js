const express = require('express');
const pool = require('../db');
const { authenticate, requireUser } = require('../auth/middleware');
const { transfer } = require('./service');
const schemas = require('../validators/wallet.schema');

const router = express.Router();

//system gives currency to user
router.post('/topup', authenticate, requireUser, async (req, res) => {
  const { error } = schemas.topup.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const treasury = await pool.query(
    `SELECT id FROM accounts WHERE account_type='system'` //select system account
  );

  //transfer from system to user
  //here user account id is obtained from the authenticated request (req.user.account_id)
  const result = await transfer({
    debitAccount: treasury.rows[0].id,
    creditAccount: req.user.account_id,
    assetType: req.body.asset_type_id,
    amount: req.body.amount,
    idempotencyKey: req.body.payment_id,
    metadata: { type: 'topup' }
  });

  res.json(result);
});

//user spends currency to system
router.post('/spend', authenticate, requireUser, async (req, res) => {
  const { error } = schemas.spend.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const treasury = await pool.query(
    `SELECT id FROM accounts WHERE account_type='system'`
  );

  //transfer from user to system
  const result = await transfer({
    debitAccount: req.user.account_id,
    creditAccount: treasury.rows[0].id,
    assetType: req.body.asset_type_id,
    amount: req.body.amount,
    metadata: { type: 'spend' }
  });

  res.json(result);
});

module.exports = router;
