const pool = require('../db');

async function lockWallets(client, accountIds, assetType) {
    //maintain consistent order to prevent deadlocks
  const ordered = [...accountIds].sort((a, b) => a - b);

  //select wallets with FOR UPDATE to lock the rows
  for (const accountId of ordered) {
    await client.query(
      `SELECT id FROM wallets
       WHERE account_id=$1 AND asset_type_id=$2
       FOR UPDATE`,
      [accountId, assetType]
    );
  }
}

async function transfer({
  debitAccount,
  creditAccount,
  assetType,
  amount,
  idempotencyKey,
  metadata
}) {
  const client = await pool.connect(); //connect to the database
  try {
    await client.query('BEGIN');

    //idempotency is when an operation can be performed multiple times without changing the result beyond the initial application. Like retrying a money transfer without causing duplicate transactions.
    if (idempotencyKey) {
      const exists = await client.query(
        `SELECT 1 FROM ledger_entries
         WHERE asset_type_id=$1 AND idempotency_key=$2`,
        [assetType, idempotencyKey]
      );
      //if its the same transaction,commit and return duplicate
      if (exists.rowCount) {
        await client.query('COMMIT');
        return { status: 'duplicate' };
      }
    }

    //lock both wallets to prevent concurrent modifications
    await lockWallets(client, [debitAccount, creditAccount], assetType);

    //debit the amount from the debit account
    const debit = await client.query(
      `SELECT balance FROM wallets
       WHERE account_id=$1 AND asset_type_id=$2`,
      [debitAccount, assetType]
    );

    //check for sufficient balance
    if (debit.rows[0].balance < amount) {
      throw new Error('Insufficient balance');
    }

    //record the ledger entry and update both wallets
    await client.query(
      `INSERT INTO ledger_entries
       (debit_account_id, credit_account_id, asset_type_id, amount, idempotency_key, metadata)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [debitAccount, creditAccount, assetType, amount, idempotencyKey, metadata]
    );

    //update balances
    await client.query(
      `UPDATE wallets SET balance = balance - $1
       WHERE account_id=$2 AND asset_type_id=$3`,
      [amount, debitAccount, assetType]
    );

    await client.query(
      `UPDATE wallets SET balance = balance + $1
       WHERE account_id=$2 AND asset_type_id=$3`,
      [amount, creditAccount, assetType]
    );

    await client.query('COMMIT');
    return { status: 'success' };

  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    //prevent connection leaks
    client.release();
  }
}

module.exports = { transfer };
