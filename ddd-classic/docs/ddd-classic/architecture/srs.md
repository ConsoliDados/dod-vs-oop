# DDD Classic — Software Requirements Specification (SRS)

The product surface. Stable contract — non-trivial changes require an ADR.

> **Shared document.** This SRS describes the **domain requirements only** (the *what*, not the *how*) and is **identical** for both implementations of the study (`ddd-classic` and `ddd-dod`). It must be kept byte-for-byte in sync between the two projects (modulo the project name in the title). Implementation choices (stack, error strategy, event delivery, **URL choreography**, **HTTP status codes**) live in each project's `sad.md` / `adrs/` / `sdds/`, **never here**.

## 1. Purpose

A double-entry financial **Ledger** service. It records money movements as immutable balanced transactions, exposes account balances and statements, and reconciles internal records against external sources. The user is a back-office operator or a system integration calling the public API. The problem it solves: a trustworthy, auditable record of financial movements where balances are always derivable from an append-only history and where no transaction can leave the books unbalanced.

The domain is chosen for this study because it naturally produces **large, append-only collections** (an account's posting history grows without bound) and **legitimate CPU-bound operations** (statement generation, reconciliation matching) — the conditions under which architectural/data-layout choices have measurable impact.

## 2. Scope

### 2.1 In scope

- Account lifecycle: open an account, read it, read its current balance, place and release holds, **freeze / reactivate**, and **close** it.
- Double-entry transaction posting: post a balanced transaction across two or more accounts; reverse a transaction.
- Posting history: list an account's postings within a time window (paginated).
- Statement generation: produce a period statement for an account (opening balance, closing balance, postings, category summary).
- Reconciliation: match a batch of external entries against internal postings within a tolerance window; report matched / unmatched / needs-review.
- Consolidation: produce a retained `BalanceSnapshot` for an account, anchoring NFR-DATA-001.

### 2.2 Out of scope

- Authentication / authorization (the API is trusted; security is not part of the study).
- Multi-currency conversion (each account is single-currency; cross-currency transactions are rejected).
- Interest, fees, scheduling, or any product-level financial logic.
- Persistence durability guarantees beyond a single process (the study uses in-process storage).
- UI. The surface is an HTTP API only; the **URL choreography** is per-implementation and lives in each `sad.md` / `sdds/`.

## 3. Functional requirements

Behavioral acceptance only — no URLs, no HTTP status codes. **"Rejected"** below maps to a validation-class error in the shared error contract (NFR-OBS-001); the per-implementation HTTP status mapping lives in each SDD. **"Not found"** similarly maps to its own error code.

| ID | Requirement | Priority | Acceptance |
|----|-------------|----------|------------|
| REQ-001 | Open an account with an owner and a currency | must | A new account is created with the given owner and currency; balance and holds start at zero |
| REQ-002 | Read an account by id | must | Returns the current account state; an absent or soft-deleted account is reported as not found |
| REQ-003 | Read an account's current available balance | must | `availableBalance = Σ(posted postings) − holdAmount` |
| REQ-004 | Place a hold on an account | should | Reduces the account's available balance by the held amount; rejected if the available balance is insufficient |
| REQ-005 | Release a previously placed hold | should | Restores the held amount to the available balance |
| REQ-006 | Post a double-entry transaction | must | Accepts 2+ postings; rejected unless `Σ debits == Σ credits`; all referenced accounts must exist, share a currency, and be **active** (not frozen/closed) |
| REQ-007 | Reverse a posted transaction | must | A reversal is a **new** transaction whose postings mirror the original (each signed amount negated) and is linked back to it; the original is never mutated (REQ-011) |
| REQ-008 | List an account's postings in a time window | must | An account's postings within `[from, to]` can be listed ordered by `postedAt`, paginated; an invalid window is rejected |
| REQ-009 | Generate a period statement | must | For a window `[from, to]`, returns an opening balance, a closing balance, the postings in range, and a per-category summary; an invalid window is rejected |
| REQ-010 | Reconcile a batch of external entries | must | Matches external entries against internal postings by `(accountId, amount, postedAt ± toleranceDays)`; reports matched / unmatched; the batch closes only when `unmatched == 0`, otherwise is reported as `needs-review` |
| REQ-011 | Posting immutability | must | Once a posting is recorded it is never updated or deleted; corrections happen via reversal (REQ-007) |
| REQ-012 | Freeze / reactivate an account | should | An account can be transitioned `active ↔ frozen`; illegal transitions (e.g. freeze a closed account, activate an active one) are rejected. A `frozen` account is rejected when posting (REQ-006) |
| REQ-013 | Close an account | should | An account is closed only if the balance recomputed from the posting history is zero (NFR-DATA-001) and no holds are open; otherwise rejected. A `closed` account is **terminal** (never reopened) and is rejected when posting (REQ-006) |
| REQ-014 | Consolidate an account's balance into a retained snapshot | should | Produces an immutable `BalanceSnapshot { accountId, asOf, balance, throughSeq }` from the posting history; idempotent — re-running over the same postings yields the same snapshot (NFR-DATA-001) |

Priorities: `must` (MVP), `should` (post-MVP), `could` (nice-to-have). REQ-012/013/014 are post-MVP enrichments pulled forward in the foil to exercise rich aggregate behavior + the study's two cross-aggregate **domain services** (`CloseAccountService`, `ConsolidateAccountBalance` — see ADR-0010 / ADR-0006); the DOD side mirrors them (NFR-CORRECT-001).

## 4. Non-functional requirements

| ID | Requirement | Notes |
|----|-------------|-------|
| NFR-PERF-001 | Statement generation over ~10k postings completes within a single request without blocking liveness | This is a CPU-bound path; exact targets and methodology in each project's `BENCHMARKS.md` |
| NFR-PERF-002 | Reconciliation of ~50k external × ~50k internal entries completes within a single request | The matching algorithm must be the **same** across implementations (sort + 2-pointer); only data layout differs |
| NFR-CORRECT-001 | The two implementations return **byte-identical JSON** for identical requests (timestamps stubbed to a fixed clock in tests) | Enforced by a conformance suite; a performance comparison is only valid once conformance passes |
| NFR-OBS-001 | Errors carry a structured, machine-readable shape (`code` + offending fields) suitable for client display | The error *delivery mechanism* (HTTP status, transport) is implementation-specific; the *shape* `{ code, message, fields?: [{ property, error }] }` is part of this contract |
| NFR-DATA-001 | Balances are always derivable from the posting history alone | In an **open period**, no balance is authoritative outside the sum of postings (cached balances are an optimization, never a source of truth). A **consolidated balance snapshot** (REQ-014) is a retained checkpoint: current balance = latest snapshot + postings after it. Once a period is closed and its postings are archived (forward-looking, beyond MVP), the snapshot becomes the retained authority for that period. |

## 5. External interfaces

### 5.1 API surface

The system exposes an HTTP API. **The specific URL choreography is not part of this SRS.** The **top-level resource surface** (`/accounts`, `/transactions`, `/reconciliation/batches`, etc.) is documented in each implementation's `sad.md` (§5.7 "HTTP resource surface"); the **per-context named-behavior endpoints** (closure, reversal, consolidation, freeze, activate, posting list, etc.) are documented in each `sdds/sdd-<context>.md` §3 — that's where the URL-to-domain mapping actually happens. This SRS owns only the **data shapes** (§5.2) and the **error contract** (NFR-OBS-001).

### 5.2 Data inputs / outputs

- **Money** is represented in integer minor units (cents) to avoid floating-point error. Currency is an ISO-4217 code.
- **Transaction input**: `{ reference?, postings: [{ accountId, amount, direction: 'debit'|'credit' }], metadata? }`.
- **Reversal input**: identifies the original transaction; carries no body of its own (the postings are derived by mirroring).
- **Posting list input**: window `{ from?, to?, limit?, cursor? }`. Pagination is cursor-based; the cursor is opaque to clients.
- **Reconciliation input**: `{ externalEntries: [{ accountId, amount, date }], toleranceDays }`.
- **Consolidation input**: identifies the account; no body (the snapshot is computed from the posting history).
- **Error output**: `{ code, message, fields?: [{ property, error }] }` — a stable shape clients can map to form errors or i18n keys.

## 6. Constraints

- **Money precision**: amounts are **integer minor units** at the currency's natural scale (2 decimal places for BRL/USD/EUR/GBP, 0 for JPY); no floating-point amounts in the domain. Rounding, where unavoidable (multiply/divide), is **half-even** (banker's). This is part of the contract — both implementations must agree so JSON stays byte-identical (NFR-CORRECT-001).
- **High-precision derived values** (interest accrual, currency conversion, installment splitting — all out of MVP scope): when introduced, they are computed in a higher-scale representation and **rounded to the currency's natural minor unit (half-even) at the posting boundary**. A posting that reaches the ledger is always whole minor units; only intermediate calculations carry extra decimal places.
- **Single currency per account**: transactions spanning accounts of different currencies are rejected.
- **Append-only history**: postings are immutable (REQ-011); this is a hard domain constraint, not an implementation choice.
- **Same domain, two implementations**: this SRS is the shared contract; the conformance suite (NFR-CORRECT-001) is the gate.
- Stack, error-handling strategy, event delivery, URL choreography, and HTTP status mapping are **deliberately not constrained here** — they are the independent variable of the study and live in each project's `sad.md` / `adrs/` / `sdds/`.

## 7. Glossary

- **Account** — a single-currency holder of balance, identified by id, owned by an owner. Has an available balance and an amount on hold.
- **Posting** — a single immutable debit or credit against one account, belonging to a transaction. Carries a signed amount and a `postedAt`.
- **Transaction** — a set of 2+ postings that balance exactly (`Σ debits == Σ credits`). The unit of consistency for a money movement.
- **Double-entry** — the bookkeeping principle (Pacioli, 1494) that every movement debits one or more accounts and credits others by an equal total.
- **Reversal** — a new transaction that mirrors a prior transaction's postings to undo its effect. The original is never mutated.
- **Hold** — an amount reserved on an account, reducing available balance without a posting (e.g. a pre-authorization).
- **Available balance** — `Σ(posted postings) − holdAmount`. What the account can actually use.
- **Account status** — `active` (default), `frozen` (temporarily blocked from new postings), or `closed` (terminal: zero-balance, never reopened, rejects postings). Transitions are intention-revealing behaviors on the aggregate; closing is gated by a domain service that verifies a zero balance against the posting history (REQ-012/013, ADR-0010).
- **Balance snapshot** — a consolidated balance for an account *as of* a point in time, retained as an immutable checkpoint (REQ-014). Current balance is derived as the latest snapshot plus the postings recorded after it.
- **Consolidation** — the act of producing a new balance snapshot for an account from the postings since its previous snapshot (REQ-014). Periodic, not instantaneous; idempotent (re-running over the same postings yields the same snapshot).
- **Statement** — a period view of an account: opening balance, closing balance, the postings in range, and a per-category summary.
- **Reconciliation batch** — a set of external entries matched against internal postings within a date/amount tolerance, producing matched/unmatched outcomes.
