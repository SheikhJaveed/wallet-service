BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Asset types (currencies)
CREATE TABLE asset_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- Accounts (users + system)
CREATE TABLE accounts (
  id SERIAL PRIMARY KEY,
  account_type TEXT NOT NULL CHECK (account_type IN ('user', 'system')),
  user_id UUID,
  name TEXT
);

-- Wallets (cached balance)
CREATE TABLE wallets (
  id SERIAL PRIMARY KEY,
  account_id INT NOT NULL REFERENCES accounts(id),
  asset_type_id INT NOT NULL REFERENCES asset_types(id),
  balance BIGINT NOT NULL DEFAULT 0,
  UNIQUE (account_id, asset_type_id)
);

-- Ledger (append-only)
CREATE TABLE ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  debit_account_id INT NOT NULL REFERENCES accounts(id),
  credit_account_id INT NOT NULL REFERENCES accounts(id),
  asset_type_id INT NOT NULL REFERENCES asset_types(id),
  amount BIGINT NOT NULL CHECK (amount > 0),
  idempotency_key TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Idempotency guarantee
CREATE UNIQUE INDEX ux_idempotency
ON ledger_entries(asset_type_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- Seed assets
INSERT INTO asset_types (name)
VALUES ('Gold Coins'), ('Reward Points');

-- System account (treasury)
INSERT INTO accounts (account_type, name)
VALUES ('system', 'Treasury');

-- Users
INSERT INTO accounts (account_type, user_id, name)
VALUES
('user', uuid_generate_v4(), 'Alice'),
('user', uuid_generate_v4(), 'Bob');

-- Wallets
-- Wallets (create wallets for ALL assets for ALL accounts)
INSERT INTO wallets (account_id, asset_type_id, balance)
SELECT
  a.id,
  at.id,
  CASE
    WHEN a.account_type = 'system' THEN 1000000
    WHEN a.name = 'Alice' AND at.name = 'Gold Coins' THEN 1000
    WHEN a.name = 'Bob'   AND at.name = 'Gold Coins' THEN 500
    ELSE 0
  END
FROM accounts a
CROSS JOIN asset_types at;

COMMIT;
