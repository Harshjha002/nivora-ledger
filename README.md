# Nivora Ledger

A backend service that models money movement the way real financial systems do: every transfer is recorded as an **immutable double-entry ledger**, protected by **MongoDB transactions** and **idempotency keys**, so balances can never drift or be double-spent — even under concurrent requests or retried network calls.

This isn't a CRUD wallet with a `balance` field that gets incremented and decremented. Balances here are *derived*, on every read, from a permanent, append-only ledger — the same principle real accounting and payment systems (Stripe, banks) are built on.

## Why this exists

Most "wallet" or "expense tracker" side projects store a mutable `balance` field on the user and update it directly. That approach silently breaks under concurrency, offers no audit trail, and can't recover from partial failures. Nivora Ledger was built to solve that properly:

- **No stored balance.** Balance is always computed by summing ledger entries. There is nothing to get out of sync.
- **Immutable ledger.** Ledger entries can never be updated or deleted at the schema level (enforced via Mongoose pre-hooks) — a real audit trail, not just a convention. Corrections are modeled as new, offsetting entries, not edits.
- **Atomic transfers.** Debit and credit entries for a transfer are created inside a single MongoDB session/transaction. Either both happen, or neither does.
- **Idempotent by design.** Every transfer requires an `Idempotency-Key` header. Retried requests (e.g. from a flaky client or network timeout) return the original result instead of double-spending.
- **Optimistic concurrency guard.** Sender accounts are versioned (`transferVersion`) and locked inside the transaction to prevent race conditions on simultaneous transfers from the same account.
- **Money stored as integers.** Amounts are stored in the smallest currency unit (paise), avoiding floating-point rounding bugs common in beginner finance projects.
- **Auditable reversal.** Admin-authorized reversals never delete or edit history — they create a compensating entry, preserving a full, honest audit trail.

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js (CommonJS) |
| Framework | Express 5 |
| Database | MongoDB + Mongoose (multi-document ACID transactions, MongoDB Atlas in production) |
| Auth | JWT (HTTP-only cookie or Bearer token) + server-side token blacklist for logout |
| Validation | Zod |
| Email | Nodemailer (Gmail OAuth2) for transactional notifications |
| Password hashing | bcryptjs |
| Logging | Pino (structured, severity-aware, with field-level redaction of secrets) |
| API docs | OpenAPI 3 spec, served interactively via Swagger UI at `/api-docs` |
| Containerization | Docker + Docker Compose |
| CI/CD | GitHub Actions — lint + test on every push, Docker image published to GHCR on `main` |

## Architecture

```
Client
  │
  ▼
Express App (src/app.js)
  │
  ├── /v1/api/auth          →  register, login, logout
  ├── /v1/api/account       →  create account, list accounts, get balance
  └── /v1/api/transaction   →  transfer funds, reverse transaction, seed initial funds (system user)
  │
  ▼
Middleware: auth (JWT + blacklist check) → validate (Zod schema)
  │
  ▼
Controllers → Mongoose Models (User, Account, Transaction, Ledger, TokenBlacklist)
  │
  ▼
MongoDB (session-scoped multi-document transactions for transfers and reversals)
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

**The reversal flow** (admin-authorized), step by step:

1. Confirm the requester is an authorized admin/system user
2. Locate the original `COMPLETED` transaction and confirm it hasn't already been reversed
3. Start a MongoDB session/transaction
4. Write new, offsetting `DEBIT`/`CREDIT` ledger entries that exactly invert the original transfer — the original entries are never edited or deleted
5. Mark the original transaction as `REVERSED` and record a link to the new compensating transaction
6. Commit — both the original and the reversal remain permanently visible in the ledger for audit purposes

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
| GET | `/transaction` | Paginated transaction history (sent + received), optional `?accountId=` filter | Yes |
| POST | `/transaction` | Transfer funds between two accounts | Yes + `Idempotency-Key` header, rate-limited |
| POST | `/transaction/:id/reverse` | Reverse a completed transaction via compensating ledger entries | Yes (admin) |
| POST | `/transaction/system/initial-funds` | Seed an account with funds from the system account | Yes (system user) + `Idempotency-Key` header, rate-limited |

> Update the reversal route path above to match your actual route file if it differs.

### Health

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Aggregate health check |
| GET | `/health/live` | Liveness probe — process is up (used by Docker `HEALTHCHECK`) |
| GET | `/health/ready` | Readiness probe — confirms the MongoDB connection is actually up, not just the process |

### API documentation

Interactive Swagger UI, generated from the OpenAPI spec at `src/docs/openapi.yaml`, is served at `/api-docs` once the server is running.

## Getting started

### Prerequisites

- Node.js 18+
- A MongoDB connection (local or Atlas) that supports transactions (replica set or Atlas cluster)

### Setup

**Option A — Docker (recommended, matches production)**

```bash
git clone https://github.com/Harshjha002/nivora-ledger.git
cd nivora-ledger
cp .env.example .env   # fill in the values below — MONGO_URI must point at an Atlas cluster
docker compose up --build
```

The app expects `MONGO_URI` to point at a MongoDB **Atlas** cluster (or any real replica set) — Atlas clusters are always provisioned as replica sets, which `session.withTransaction()` requires. A bare standalone MongoDB container is not sufficient, which is why Compose here doesn't bundle a local Mongo service.

**Option B — Local Node**

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
| `MONGO_URI` | MongoDB connection string — must be a replica set (Atlas satisfies this automatically) |
| `JWT_SECRET` | Secret used to sign JWTs |
| `EMAIL_USER` | Gmail address used to send transactional emails |
| `CLIENT_ID` | Google OAuth2 client ID — used only to authorize Gmail API access for sending emails (not user login) |
| `CLIENT_SECRET` | Google OAuth2 client secret — same purpose |
| `REFRESH_TOKEN` | Long-lived token so the app can send email without re-authenticating each time |
| `CLIENT_URL` | Frontend/client origin, used for CORS configuration |
| `LOG_LEVEL` | Pino log level: `fatal`, `error`, `warn`, `info`, `debug`, or `trace` (default: `info`) |
| `LOGIN_RATE_LIMIT_MAX` | Max login attempts per email within the window (default: 5) |
| `LOGIN_RATE_LIMIT_WINDOW_MS` | Login rate-limit window in ms (default: 15 minutes) |
| `REGISTER_RATE_LIMIT_MAX` | Max registration attempts per IP within the window (default: 5) |
| `REGISTER_RATE_LIMIT_WINDOW_MS` | Registration rate-limit window in ms (default: 15 minutes) |
| `TRANSACTION_RATE_LIMIT_MAX` | Max transfer attempts per user within the window (default: 30) |
| `TRANSACTION_RATE_LIMIT_WINDOW_MS` | Transfer rate-limit window in ms (default: 1 minute) |

Once running, confirm it's alive:

```bash
curl http://localhost:3000/health
```

## Testing

> **TODO: confirm the current test count** (run `npm test` and update the number below — the previous README said 38, and a later commit improved coverage, so this number has likely changed).

**[X] Jest/Supertest tests** across auth, account isolation, transfer correctness, reversal, rate limiting, and health checks — run against a real single-node MongoDB **replica set** (via `mongodb-memory-server`), not a standalone instance, so transactional code paths are actually exercised, not mocked around.

```bash
npm install --save-dev jest supertest mongodb-memory-server
npm test
```

Notable cases:
- **Concurrency / no-double-spend proof** — fires 5 simultaneous full-balance transfer attempts from one account and asserts exactly one succeeds and the balance never goes negative, proving the `transferVersion` locking actually works under a race, not just on paper.
- **Idempotency proof** — retries a transfer with the same `Idempotency-Key` and asserts the balance is unaffected by the retry.
- **Account isolation** — one user can never read another user's account balance or transaction history (404/403, not a data leak).
- **Rate limiting** — both the login limiter (keyed per email) and the transfer limiter (keyed per user) are asserted to actually return `429` once exceeded, not just configured and assumed to work. Register, login, and transaction rate-limit tests each run in their own file with an isolated in-memory store, reset between every test, so one test's legitimate requests can never exhaust another test's budget.
- **Ledger immutability** — direct mutation of a ledger entry is asserted to throw at the schema level.
- **Reversal correctness** — reversing a completed transaction produces exact offsetting entries, marks the original as `REVERSED`, and never mutates or deletes the original entries.

## CI/CD

GitHub Actions runs on every push: install → lint → test. On `main`, a Docker image is built and published to GitHub Container Registry (GHCR).

> Add a build-status badge here once you have the workflow file name, e.g.
> `![CI](https://github.com/Harshjha002/nivora-ledger/actions/workflows/<file>.yml/badge.svg)`

## Project structure

```
src/
├── app.js                       # Express app, route mounting, error handling
├── config/
│   ├── db.js                     # MongoDB connection
│   ├── env.js                    # Validated environment configuration
│   ├── logger.js                 # Pino structured logger (with secret redaction)
│   └── swagger.js                # Swagger UI setup
├── controller/                   # Route handlers (auth, account, transaction)
├── services/                     # Business logic (auth, account, transaction, reversal, email)
├── middleware/                   # JWT auth, system-user guard, Zod validation, rate limiting
├── models/                       # User, Account, Transaction, Ledger, TokenBlacklist
├── routes/                       # Route definitions
├── dto/                          # Response shaping (transaction history)
├── validation/                   # Zod schemas
└── docs/openapi.yaml             # OpenAPI 3 spec, served via /api-docs
server.js                         # Entry point — startup, graceful shutdown
Dockerfile / docker-compose.yml   # Containerized app (Atlas for MongoDB)
.github/workflows/                # CI: lint, test, GHCR image publish
```

## Design decisions worth knowing about

- **Ledger over stored balance.** Every balance query re-aggregates ledger entries. Slightly more read cost, but correctness is guaranteed by construction rather than by careful bookkeeping in application code.
- **Ledger entries are immutable.** `findOneAndUpdate`, `updateOne`, `deleteOne`, etc. are blocked at the schema level with pre-hooks that throw — corrections must be modeled as new, offsetting entries (the standard accounting pattern), not edits.
- **`transferVersion` as a lock.** Incrementing this field inside the transaction forces MongoDB to serialize concurrent transfers from the same account, preventing two simultaneous transfers from both reading a stale balance.
- **Idempotency keys are mandatory, not optional**, on every money-moving endpoint — this is how production payment APIs (Stripe included) prevent duplicate charges from client retries.
- **Reversal as compensation, not deletion.** Following the same immutability principle as the rest of the ledger, reversing a transaction never touches the original record — it appends new entries that cancel it out, so the full history (including mistakes and corrections) is always visible.

## Roadmap

**Completed**
- [x] Automated tests (Jest/Supertest) covering the transfer flow, concurrency, idempotency, reversal, and rate limiting — run against a real Mongo replica set
- [x] Paginated transaction history endpoint
- [x] Rate limiting on auth and transfer endpoints (env-configurable, per-email/per-IP/per-user keyed, with isolated resettable stores for testing)
- [x] Structured logging with Pino, including request correlation via `pino-http` and field-level redaction of secrets (passwords, tokens, cookies)
- [x] OpenAPI 3 specification with interactive Swagger UI at `/api-docs`
- [x] Liveness and readiness health checks (`/health/live`, `/health/ready`), with the readiness probe actually verifying the MongoDB connection
- [x] Dockerfile + docker-compose for one-command local setup, running against MongoDB Atlas (a real replica set, satisfying the transaction requirement without extra config)
- [x] Admin-authorized transaction reversal via compensating ledger entries
- [x] CI pipeline — lint + test on every push, Docker image published to GHCR

**Planned**
- [ ] Deployed to production with a live URL
- [ ] Prometheus metrics + Grafana dashboard

**Deliberately out of scope for this project**
Redis, Kafka, and Elasticsearch are intentionally not part of this repo. A single-service ledger with a small, well-understood event surface (one email notification) doesn't provide a genuine justification for a message broker or a search index — adding them here would be resume-keyword engineering rather than solving a real problem this system has. They're reserved for a separate, dedicated microservices project where multi-consumer event fan-out and full-text search are actual product requirements.

## License

ISC