# Dod Vs Oop Classic — Software Requirements Specification (SRS)

The product surface. Stable contract — non-trivial changes require an ADR.

> **Shared document.** This SRS describes the **domain requirements only** (the *what*, not the *how*) and is **identical** for both implementations of the study (`dod-vs-oop-classic` and `dod-vs-oop-dod`). It must be kept byte-for-byte in sync between the two projects (modulo the project name in the title). Implementation choices (stack, error strategy, event delivery) live in each project's `sad.md` / `adrs/` / `sdds/`, never here.

## 1. Purpose

A double-entry financial **Ledger** service. It records money movements as immutable balanced transactions, exposes account balances and statements, and reconciles internal records against external sources. The user is a back-office operator or a system integration calling the HTTP API. The problem it solves: a trustworthy, auditable record of financial movements where balances are always derivable from an append-only history and where no transaction can leave the books unbalanced.

The domain is chosen for this study because it naturally produces **large, append-only collections** (an account's posting history grows without bound) and **legitimate CPU-bound operations** (statement generation, reconciliation matching) — the conditions under which architectural/data-layout choices have measurable impact.

## 2. Scope

### 2.1 In scope

- Account lifecycle: open an account, read it, read its current balance, place and release holds.
- Double-entry transaction posting: post a balanced transaction across two or more accounts; reverse a transaction.
- Posting history: list an account's postings within a time window (paginated).
- Statement generation: produce a period statement for an account (opening balance, closing balance, postings, category summary).
- Reconciliation: match a batch of external entries against internal postings within a tolerance window; report matched / unmatched / needs-review.

### 2.2 Out of scope

- Authentication / authorization (the API is trusted; security is not part of the study).
- Multi-currency conversion (each account is single-currency; cross-currency transactions are rejected).
- Interest, fees, scheduling, or any product-level financial logic.
- Persistence durability guarantees beyond a single process (the study uses in-process storage).
- UI. The surface is HTTP only.

## 3. Functional requirements

| ID | Requirement | Priority | Acceptance |
|----|-------------|----------|------------|
| REQ-001 | Open an account with an owner and a currency | must | `POST /accounts` returns 201 with a new account id; balance and holds start at 0 |
| REQ-002 | Read an account by id | must | `GET /accounts/:id` returns 200 with account state; 404 if absent or soft-deleted |
| REQ-003 | Read an account's current available balance | must | `GET /accounts/:id/balance` returns `availableBalance = Σ(posted postings) − holdAmount` |
| REQ-004 | Place a hold on an account | should | `POST /accounts/:id/holds` reduces available balance by the held amount; rejects if insufficient available balance |
| REQ-005 | Release a previously placed hold | should | `DELETE /accounts/:id/holds/:holdId` restores the held amount to available balance |
| REQ-006 | Post a double-entry transaction | must | `POST /transactions` accepts 2+ postings; rejects (422) unless `Σ debits == Σ credits`; all referenced accounts must exist and share currency |
| REQ-007 | Reverse a posted transaction | must | `POST /transactions/:id/reversals` creates a new transaction with mirrored postings; the original is never mutated |
| REQ-008 | List an account's postings in a window | must | `GET /accounts/:id/postings?from=&to=&limit=` returns postings ordered by `postedAt`, paginated |
| REQ-009 | Generate a period statement | must | `POST /accounts/:id/statements` with `{from,to}` returns opening/closing balances, the postings in range, and a per-category summary |
| REQ-010 | Reconcile a batch of external entries | must | `POST /reconciliation/batches` with external entries matches them against internal postings by `(accountId, amount, postedAt ± toleranceDays)`; returns matched / unmatched; batch closes only when `unmatched == 0`, else status `needs-review` |
| REQ-011 | Posting immutability | must | Once a posting is recorded it is never updated or deleted; corrections happen via reversal (REQ-007) |

Priorities: `must` (MVP), `should` (post-MVP), `could` (nice-to-have).

## 4. Non-functional requirements

| ID | Requirement | Notes |
|----|-------------|-------|
| NFR-PERF-001 | Statement generation over ~10k postings completes within a single request without blocking liveness | This is a CPU-bound path; exact targets and methodology in each project's `BENCHMARKS.md` |
| NFR-PERF-002 | Reconciliation of ~50k external × ~50k internal entries completes within a single request | The matching algorithm must be the **same** across implementations (sort + 2-pointer); only data layout differs |
| NFR-CORRECT-001 | The two implementations return **byte-identical JSON** for identical requests (timestamps stubbed to a fixed clock in tests) | Enforced by a conformance suite; a performance comparison is only valid once conformance passes |
| NFR-OBS-001 | Errors carry a structured, machine-readable shape (code + offending field) suitable for client display | The error *delivery mechanism* is implementation-specific; the *shape* is part of this contract |
| NFR-DATA-001 | Balances are always derivable from the posting history alone | In an **open period**, no balance is authoritative outside the sum of postings (cached balances are an optimization, never a source of truth). A **consolidated balance snapshot** (taken at a point in time) is a retained checkpoint: current balance = latest snapshot + postings after it. Once a period is closed and its postings are archived (forward-looking, beyond MVP), the snapshot becomes the retained authority for that period. |

## 5. External interfaces

### 5.1 HTTP API surface

| Verb | Path | Purpose | Success | Failure |
|------|------|---------|---------|---------|
| POST | `/accounts` | Open account | 201 | 422 invalid input |
| GET | `/accounts/:id` | Read account | 200 | 404 not found |
| GET | `/accounts/:id/balance` | Read available balance | 200 | 404 |
| POST | `/accounts/:id/holds` | Place hold | 201 | 404, 422 insufficient funds |
| DELETE | `/accounts/:id/holds/:holdId` | Release hold | 204 | 404 |
| POST | `/transactions` | Post double-entry transaction | 201 | 422 unbalanced / currency mismatch, 404 account absent |
| POST | `/transactions/:id/reversals` | Reverse a transaction | 201 | 404, 409 already reversed |
| GET | `/accounts/:id/postings` | List postings (`from`,`to`,`limit`) | 200 | 404 |
| POST | `/accounts/:id/statements` | Generate statement (`from`,`to`) | 200 | 404, 422 invalid range |
| POST | `/reconciliation/batches` | Reconcile external entries | 200 | 422 invalid payload |

### 5.2 Data inputs / outputs

- **Money** is represented in integer minor units (cents) to avoid floating-point error. Currency is an ISO-4217 code.
- **Transaction input**: `{ reference?, postings: [{ accountId, amount, direction: 'debit'|'credit' }], metadata? }`.
- **Reconciliation input**: `{ externalEntries: [{ accountId, amount, date }], toleranceDays }`.
- **Error output**: `{ code, message, fields?: [{ property, error }] }` — a stable shape clients can map to form errors or i18n keys.

## 6. Constraints

- **Money precision**: amounts are **integer minor units** at the currency's natural scale (2 decimal places for BRL/USD/EUR/GBP, 0 for JPY); no floating-point amounts in the domain. Rounding, where unavoidable (multiply/divide), is **half-even** (banker's). This is part of the contract — both implementations must agree so JSON stays byte-identical (NFR-CORRECT-001).
- **High-precision derived values** (interest accrual, currency conversion, installment splitting — all out of MVP scope): when introduced, they are computed in a higher-scale representation and **rounded to the currency's natural minor unit (half-even) at the posting boundary**. A posting that reaches the ledger is always whole minor units; only intermediate calculations carry extra decimal places.
- **Single currency per account**: transactions spanning accounts of different currencies are rejected.
- **Append-only history**: postings are immutable (REQ-011); this is a hard domain constraint, not an implementation choice.
- **Same domain, two implementations**: this SRS is the shared contract; the conformance suite (NFR-CORRECT-001) is the gate.
- Stack, error-handling strategy, and event delivery are **deliberately not constrained here** — they are the independent variable of the study and live in each project's `sad.md` / `adrs/`.

## 7. Glossary

- **Account** — a single-currency holder of balance, identified by id, owned by an owner. Has an available balance and an amount on hold.
- **Posting** — a single immutable debit or credit against one account, belonging to a transaction. Carries a signed amount and a `postedAt`.
- **Transaction** — a set of 2+ postings that balance exactly (`Σ debits == Σ credits`). The unit of consistency for a money movement.
- **Double-entry** — the bookkeeping principle (Pacioli, 1494) that every movement debits one or more accounts and credits others by an equal total.
- **Reversal** — a new transaction that mirrors a prior transaction's postings to undo its effect. The original is never mutated.
- **Hold** — an amount reserved on an account, reducing available balance without a posting (e.g. a pre-authorization).
- **Available balance** — `Σ(posted postings) − holdAmount`. What the account can actually use.
- **Balance snapshot** — a consolidated balance for an account *as of* a point in time, retained as an immutable checkpoint. Current balance is derived as the latest snapshot plus the postings recorded after it.
- **Consolidation** — the act of producing a new balance snapshot for an account from the postings since its previous snapshot. Periodic, not instantaneous; idempotent (re-running over the same postings yields the same snapshot).
- **Statement** — a period view of an account: opening balance, closing balance, the postings in range, and a per-category summary.
- **Reconciliation batch** — a set of external entries matched against internal postings within a date/amount tolerance, producing matched/unmatched outcomes.
