# Nivora Ledger

A backend service that models money movement the way real financial systems do: every transfer is recorded as an **immutable double-entry ledger**, protected by **MongoDB transactions** and **idempotency keys**, so balances can never drift or be double-spent — even under concurrent requests or retried network calls.

This isn't a CRUD wallet with a `balance` field that gets incremented and decremented. Balances here are *derived*, on every read, from a permanent, append-only ledger — the same principle real accounting and payment systems (Stripe, banks) are built on.

## Why this exists

Most "wallet" or "expense tracker" side projects store a mutable `balance` field on the user and update it directly. That approach silently breaks under concurrency, offers no audit trail, and can't recover from partial failures. Nivora Ledger was built to solve that properly:

- **No stored balance.** Balance is always computed by summing ledger entries. There is nothing to get out of sync.
- **Immutable ledger.** Ledger entries can never be updated or deleted at the schema level (enforced via Mongoose pre-hooks) — a real audit trail, not just a convention.
- **Atomic transfers.** Debit and credit entries for a transfer are created inside a single MongoDB session/transaction. Either both happen, or neither does.
- **Idempotent by design.** Every transfer requires an `Idempotency-Key` header. Retried requests (e.g. from a flaky client or network timeout) return the original result instead of double-spending.
- **Optimistic concurrency guard.** Sender accounts are versioned (`transferVersion`) and locked inside the transaction to prevent race conditions on simultaneous transfers from the same account.
- **Money stored as integers.** Amounts are stored in the smallest currency unit (paise), avoiding floating-point rounding bugs common in beginner finance projects.

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js (CommonJS) |
| Framework | Express 5 |
| Database | MongoDB + Mongoose (multi-document ACID transactions) |
| Auth | JWT (HTTP-only cookie or Bearer token) + server-side token blacklist for logout |
| Validation | Zod |
| Email | Nodemailer (Gmail OAuth2) for transactional notifications |
| Password hashing | bcryptjs |

## Architecture

```
Client
  │
  ▼
Express App (src/app.js)
  │
  ├── /v1/api/auth          →  register, login, logout
  ├── /v1/api/account       →  create account, list accounts, get balance
  └── /v1/api/transaction   →  transfer funds, seed initial funds (system user)
  │
  ▼
Middleware: auth (JWT + blacklist check) → validate (Zod schema)
  │
  ▼
Controllers → Mongoose Models (User, Account, Transaction, Ledger, TokenBlacklist)
  │
  ▼
MongoDB (session-scoped multi-document transactions for transfers)
```

**The transfer flow** (`POST /v1/api/transaction`), step by step:

1. Validate request body against a Zod schema
2. Reject if sender and receiver accounts are identical
3. Validate the `Idempotency-Key` header (16–100 chars)
4. Check for an existing transaction with that key — return the cached result if found (idempotency)
5. Confirm both accounts exist, belong to the requester, and are `ACTIVE`
6. Start a MongoDB session and lock the sender account (`transferVersion` increment)
7. Compute the sender's real-time balance from the ledger and confirm sufficient funds
8. Create the `Transaction` record as `PENDING`
9. Write a `DEBIT` ledger entry (sender) and a `CREDIT` ledger entry (receiver)
10. Mark the transaction `COMPLETED` and commit the transaction
11. Send a (best-effort, non-blocking) email receipt — a failed email never rolls back a completed transfer

## API reference

Base URL: `/v1/api`

### Auth

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/auth/register` | Create a user account | No |
| POST | `/auth/login` | Log in, receive JWT (cookie) | No |
| POST | `/auth/logout` | Invalidate current token | Yes |

### Accounts

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/account` | Create a ledger account for the logged-in user | Yes |
| GET | `/account` | List the logged-in user's accounts | Yes |
| GET | `/account/balance/:accountId` | Get an account's real-time balance (derived from the ledger) | Yes |

### Transactions

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/transaction` | Transfer funds between two accounts | Yes + `Idempotency-Key` header |
| POST | `/transaction/system/initial-funds` | Seed an account with funds from the system account | Yes (system user) + `Idempotency-Key` header |

### Health

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Service liveness check |

## Getting started

### Prerequisites

- Node.js 18+
- A MongoDB connection (local or Atlas) that supports transactions (replica set or Atlas cluster)

### Setup

```bash
git clone https://github.com/Harshjha002/nivora-ledger.git
cd nivora-ledger
npm install
cp .env.example .env   # then fill in the values below
npm run dev             # nodemon, for local development
# or
npm start                # production
```

### Environment variables

| Variable | Description |
|---|---|
| `PORT` | Port the server listens on (defaults to 3000) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign JWTs |
| `EMAIL_USER` | Gmail address used to send transactional emails |
| `CLIENT_ID` | 	Google OAuth2 client ID — used only to authorize Gmail API access for sending emails|
| `CLIENT_SECRET` | Google OAuth2 client secret — same purpose |
| `REFRESH_TOKEN` | Long-lived token so the app can send email without re-authenticating each time |

Once running, confirm it's alive:

```bash
curl http://localhost:3000/health
```

## Project structure

```
src/
├── app.js                     # Express app, route mounting, error handling
├── config/db.js                # MongoDB connection
├── controller/                 # Route handlers (auth, account, transaction)
├── middleware/                 # JWT auth, system-user guard, Zod validation
├── models/                     # User, Account, Transaction, Ledger, TokenBlacklist
├── routes/                     # Route definitions
├── services/email.service.js   # Transactional email templates
└── validation/                 # Zod schemas
server.js                       # Entry point
```

## Design decisions worth knowing about

- **Ledger over stored balance.** Every balance query re-aggregates ledger entries. Slightly more read cost, but correctness is guaranteed by construction rather than by careful bookkeeping in application code.
- **Ledger entries are immutable.** `findOneAndUpdate`, `updateOne`, `deleteOne`, etc. are blocked at the schema level with pre-hooks that throw — corrections must be modeled as new, offsetting entries (the standard accounting pattern), not edits.
- **`transferVersion` as a lock.** Incrementing this field inside the transaction forces MongoDB to serialize concurrent transfers from the same account, preventing two simultaneous transfers from both reading a stale balance.
- **Idempotency keys are mandatory, not optional**, on every money-moving endpoint — this is how production payment APIs (Stripe included) prevent duplicate charges from client retries.

## Roadmap

- [ ] Automated tests (Jest/Supertest) covering the transfer flow, especially concurrency and idempotency edge cases
- [ ] OpenAPI/Swagger documentation
- [ ] Dockerfile + docker-compose for one-command local setup
- [ ] Rate limiting on auth and transfer endpoints
- [ ] Structured logging (Pino/Winston)
- [ ] CI pipeline (lint + test on every PR)
- [ ] Transaction reversal endpoint (offsetting ledger entries)

## License

ISC