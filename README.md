# Internal Wallet Service

## Overview

This project implements an **internal wallet service** for a high-traffic application such as a gaming platform or a loyalty rewards system. The service manages application-specific virtual credits (for example, *Gold Coins* and *Reward Points*) in a **closed-loop system**, meaning these credits exist only inside the application and are not real money.

The primary focus of this system is **correctness, consistency, and reliability** under concurrent access. Every credit or debit operation is handled transactionally, ensuring that balances never go out of sync and no transaction is lost, even under retries or partial failures.

---

## Project Goals

- Maintain accurate wallet balances for users
- Guarantee transactional integrity for all operations
- Prevent race conditions in high-concurrency scenarios
- Support idempotent operations to safely handle retries
- Provide a clean, reproducible setup using Docker

---

## System Architecture

### High-Level Design

- **PostgreSQL** serves as the primary datastore and source of truth.
- Wallet operations are executed inside database transactions.
- A **ledger-based (double-entry) accounting model** is used:
  - Every transaction has a debit account and a credit account.
  - Ledger entries are immutable and append-only.
- A **system account (Treasury)** acts as the counterparty for user transactions.
- Wallet balances are stored as cached values derived from the ledger.

### Data Flow

1. API request is authenticated using JWT.
2. Input is validated at the API layer.
3. Wallet rows are locked in a deterministic order to avoid deadlocks.
4. A ledger entry is inserted.
5. Wallet balances are updated.
6. The transaction is committed atomically.

---

## Tech Stack

- **Backend:** Node.js (Express)
- **Database:** PostgreSQL 15
- **Authentication:** JWT (JSON Web Tokens)
- **Validation:** Joi
- **Containerization:** Docker & Docker Compose

---

## Database Schema

### Core Tables

- **asset_types**  
  Defines supported virtual currencies (e.g., Gold Coins, Reward Points).

- **accounts**  
  Stores user accounts and system accounts (such as Treasury).

- **wallets**  
  Stores the cached balance for each `(account, asset_type)` pair.

- **ledger_entries**  
  Immutable log of all transfers using a double-entry model.

### Key Constraints

- Unique `(account_id, asset_type_id)` per wallet
- Ledger entries enforce positive transfer amounts
- Idempotency ensured via a unique index on `(asset_type_id, idempotency_key)`

---

## Concurrency & Data Integrity Strategy

- All wallet operations run inside a single database transaction.
- Wallet rows are locked using `SELECT ... FOR UPDATE`.
- Locks are acquired in a deterministic order to prevent deadlocks.
- Balances are checked before debiting to prevent negative values.
- Ledger entries are written **before** balance updates.

---

## Idempotency Handling

- Each externally-triggered transaction (such as top-ups) can include an `idempotency_key`.
- The system checks for an existing ledger entry with the same key.
- If found, the transaction is safely ignored, preventing duplicate credits.

---

## API Overview

### Authentication

- `POST /auth/login`  
  Issues a JWT for a valid user.

### Wallet Operations

- `POST /wallet/topup`  
  Credits a user wallet from the system account.

- `POST /wallet/spend`  
  Debits a user wallet and credits the system account.

---

## Project Structure
```bash
wallet-service/
├── docker-compose.yml
├── Dockerfile
├── seed.sql
├── package.json
├── README.md
└── src/
    ├── app.js
    ├── db.js
    ├── auth/
    │   ├── jwt.js
    │   └── middleware.js
    |   └── routes.js
    ├── wallet/
    │   ├── service.js
    │   └── routes.js
    ├── validators/
        └── wallet.schemas.js
   
```


---

## Setup & Running the Project

### Prerequisites

- Docker
- Docker Compose

### Run the Service

```bash
docker-compose up --build
```

**Note**: This command also initalizes the database using seed.sql

### To reset the DB
```bash
docker-compose down -v
docker-compose up --build
```

### Seed Data

- On first startup, the system initializes:
- Asset types (Gold Coins, Reward Points)
- A system account (Treasury)
- Two users (Alice and Bob)
- Wallets for all account–asset combinations with initial balances


### Notes on Design Choices

- A ledger-based approach was chosen for auditability and correctness.
- Cached balances are used for fast reads while the ledger remains the source of truth.
- PostgreSQL row-level locking ensures correctness under concurrent requests.
- Docker-based setup ensures reproducibility for reviewers and evaluators.
- The system currently supports **two asset types**:
  - **Gold Coins** – representing purchasable in-app credits
  - **Reward Points** – representing promotional or incentive-based credits
- A Docker-based setup ensures reproducibility and allows the entire system (application and database) to be started with a single command.

## Testing the APIs Using Postman

The following steps describe how to test the wallet service using Postman.

### 1. Authentication (Login)
**Endpoint** POST: ```http:localhost:3000/auth/login```


Before testing the APIs, a valid `user_id` must be obtained from the database. This UUID is required for authentication.

### 1. Enter the PostgreSQL Container

From the project root directory, run:

```bash
docker exec -it wallet-db psql -U postgres -d walletdb
```
once you enter the walletdb - select a UUID of a user. (Since, the focus was on the wallet service, I have kept the authentication using jwt to be this type.)

```bash
> docker exec -it wallet-db psql -U postgres -d walletdb
psql (15.15 (Debian 15.15-1.pgdg13+1))
Type "help" for help.

walletdb=# select * from accounts;
 id | account_type |               user_id                |   name   
----+--------------+--------------------------------------+----------
  1 | system       |                                      | Treasury
  2 | user         | 0f6d220d-61fa-4be7-b0a2-e05dbd9aee32 | Alice
  3 | user         | b55709be-d0f6-467e-942c-cc04155ad54c | Bob
(3 rows)

walletdb=# 
```
Copy the user_id of the desired user (for example, Alice) and paste it as:
```bash
{
  "user_id": "0f6d220d-61fa-4be7-b0a2-e05dbd9aee32"
}
```
in the body section of the request as JSON.

**Response**:
```
{
    "token": "eyJhbGciOiJIUzI1Ni.........."
}
```

### 2. Top-up

**Endpoint** ```POST: http:localhost:3000/wallet/topup```

Copy this token and add it in the Authorization section and select Bearer token option from the dropdown and paste this token there.

and then send a raw body(JSON) like:
```bash
{
  "amount": 300,
  "asset_type_id": 1,
  "payment_id": "pay_test_001"
}
```

**Response**:
```bash
{
    "status": "success"
}
```

### 3. Spend

**Endpoint** ```POST: http:localhost:3000/wallet/spend```

Copy this token and add it in the Authorization section and select Bearer token option from the dropdown and paste this token there.

and then send a raw body(JSON) like:
```bash
{
  "amount": 20,
  "asset_type_id": 1
}

```

**Response**:
```bash
{
    "status": "success"
}
```

**To Check the amount details**
Execute this command 
```bash
SELECT
  a.id AS account_id,
  a.name AS account_name,
  at.name AS asset,
  w.balance
FROM wallets w
JOIN accounts a ON a.id = w.account_id
JOIN asset_types at ON at.id = w.asset_type_id
ORDER BY a.name, at.name;
```

Example:
```bash
> docker exec -it wallet-db psql -U postgres -d walletdb 

psql (15.15 (Debian 15.15-1.pgdg13+1))
Type "help" for help.

walletdb=# SELECT
  a.id AS account_id,
  a.name AS account_name,
  at.name AS asset,
  w.balance
FROM wallets w
JOIN accounts a ON a.id = w.account_id
JOIN asset_types at ON at.id = w.asset_type_id
ORDER BY a.name, at.name;\q
 account_id | account_name |     asset     | balance 
------------+--------------+---------------+---------
          2 | Alice        | Gold Coins    |    1280
          2 | Alice        | Reward Points |     460
          3 | Bob          | Gold Coins    |     500
          3 | Bob          | Reward Points |       0
          1 | Treasury     | Gold Coins    |  999720
          1 | Treasury     | Reward Points |  999540
(6 rows)


```
### Conclusion

This project demonstrates a production-oriented approach to building a reliable internal wallet system. It emphasizes correctness, auditability, and safe concurrency handling, aligning closely with real-world financial system design principles.