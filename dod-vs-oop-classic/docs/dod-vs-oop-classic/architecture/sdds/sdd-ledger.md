---
id: SDD-002
title: ledger
status: draft
date: 2026-05-22
---

# SDD-002 — ledger

> Tactical design of the `ledger` bounded context. Companion to `sad.md` §3.
> Verbose-canonical OOP, **throw-based** (ADR-0002), framework-agnostic
> application (ADR-0005). State after FEAT-002 (post-transaction); reversal and
> list-postings are later features.

## 1. Bounded context / area

Owns the **append-only source of truth**: balanced double-entry transactions and
their immutable postings (REQ-006, REQ-011). Lives in `src/ledger/`
(`domain/` → `application/` → `infrastructure/`). Depends on `src/core/` +
`src/shared/`. Does not own account balance (`accounts` reacts to
`TransactionPosted` in FEAT-003), statements, or reconciliation. Cross-context:
**reads** account currency via the `AccountLookup` port (ACL), **writes** via the
`TransactionPosted` event (in-memory bus, no Outbox — ADR-0003). Never imports
`accounts/domain`.

## 2. Aggregates / domain types

**`TransactionAggregate`** (root) — `reference?`, `postings: Posting[]`,
`metadata`, `postedAt`, plus base id/timestamps. Factories `create(input)`
(builds postings, validates) and `buildExisting`. `TransactionPosted` is built &
published by `PostTransactionUseCase` from the **persisted** postings (it needs
each posting's `sequence`; ADR-0008), not emitted on `create`.

**`Posting`** (entity inside the transaction) — `accountId: Identifier`,
`amount: Money` (**signed**: credit +, debit −), `postedAt`, `sequence?`
(global monotonic order assigned at persistence). `getSignedCents()`,
`getDirection()` (derived from sign).

Supporting: `PostingDirection` (`debit | credit`); `TransactionEntry` (event
payload row `{ accountId, amountCents, currency, sequence }`, ADR-0008);
`TransactionDto` / `PostingDto` (client shapes, signed cents).

**Balance model link (ADR-0006):** the posting `sequence` *is* the `throughSeq`
checkpoint key — current balance = latest snapshot + Σ(postings with `sequence`
after it).

## 3. Use cases / operations

Framework-free plain classes; throw-based (ADR-0002); NestJS wiring in
`infrastructure/provider/`.

| Operation | Input | Output | Errors (thrown) |
|-----------|-------|--------|-----------------|
| `PostTransactionUseCase` | `{ reference?, metadata?, postings: [{ accountId, amountCents, direction }] }` | `TransactionDto` (201) | `TransactionAccountNotFoundError` → 404; `InvalidEntityError` (unbalanced / <2 postings / multi-currency) → 422. **Planned (FEAT-007, not yet shipped):** reject a posting to a non-`active` account → 422 (REQ-006) — depends on the status-aware `AccountLookup` (§6) |

HTTP (`TransactionController`): `POST /transactions` (SRS input `{ accountId, amount, direction }`, converted to signed at the boundary).

## 4. Invariants

1. A transaction has **≥ 2 postings**. *(test: aggregate + validator specs, e2e)*
2. A transaction is **balanced**: `Σ(signed cents) == 0` (`Σ debits == Σ credits`). *(test: aggregate spec, e2e)*
3. All postings of a transaction **share a single currency**. *(test: aggregate spec, e2e)*
4. Each posting moves a **non-zero** amount. *(test: posting spec)*
5. All referenced accounts **exist** and (by sharing currency, since each posting's currency is its account's) the transaction is single-currency. *(test: e2e — 404 + 422)*
6. **Postings are immutable** (REQ-011): no update/delete path; corrections are reversals. `TransactionAggregate` / `Posting` are therefore **deliberately behavior-light** — factories + getters, no state mutators — which is the domain rule, **not** an anemic-domain smell (contrast `AccountAggregate`, whose mutable cache/status legitimately carry behavior like `reflectPosting`, `freeze`/`close`). Documented inline on the classes.
7. An invalid transaction/posting **cannot be constructed** — validators throw in the constructor (ADR-0002).
8. Posting amounts are whole minor units, signed, `bigint` cents (ADR-0004).

## 5. Errors

- Domain: `InvalidEntityError` (aggregate + posting validation) → **422** `{ code: 'VALIDATION_ERROR', message, fields[] }`.
- Application: `TransactionAccountNotFoundError extends UseCaseError` (code `ACCOUNT_NOT_FOUND`) → **404** via the filter's `*_NOT_FOUND` convention.

## 6. Ports / external dependencies

- **`AccountLookup` port** (`application/ports/`) — cross-context read; today returns the local `AccountView { id, currency }`. Implemented by `AccountLookupTypeOrm` (ACL) reading the `accounts` table read-only — the single place ledger infra touches the accounts persistence entity. **Planned (FEAT-007, not yet shipped):** extend `AccountView` with `status` so `PostTransactionUseCase` can reject (422) a posting to a non-`active` account (REQ-006).
- **`CreateTransactionRepository` port** (segregated) — atomic insert of the transaction + postings (one `DataSource.transaction`); returns the rehydrated aggregate with DB-assigned `sequence`. Bound via Symbol token in `infrastructure/provider/repositories/`.
- **Persistence:** `TransactionTypeOrmEntity` (`transactions`) + `PostingTypeOrmEntity` (`postings`, `sequence` PK = monotonic order, signed `amountCents bigint`) + bidirectional `TransactionTypeOrmMapper`. Stack per ADR-0001.
- **Events:** publishes `TransactionPostedEvent` (plain-data `entries` `{ accountId, amountCents, currency, sequence }`, ADR-0008) via the `EventBus` port — built by `PostTransactionUseCase` from the **persisted** postings, so each entry carries its DB `sequence`.
- **HTTP:** `TransactionController` (`POST /transactions`); `PostTransactionRequest` DTO (no class-validator).

## 7. Open items

- ✅ Reflect balance on `accounts` via the `OnTransactionPostedHandler` (FEAT-003, done) — `accounts` subscribes to `TransactionPosted`; ADR-0008 added `sequence` to the payload so the consumer needn't read ledger tables.
- Reverse a transaction — `POST /transactions/:id/reversals` (FEAT-004, REQ-007); mirror postings, original never mutated.
- List postings — `GET /accounts/:id/postings?from=&to=&limit=` (FEAT-005, REQ-008); a query repository over `postings`.
- The **signed / credit-positive convention** is a candidate ADR once the cross-implementation conformance suite lands (the DOD side must match for byte-identical JSON, NFR-CORRECT-001).
- `sequence` monotonicity relies on sqlite `INTEGER PRIMARY KEY`; revisit if the persistence/concurrency model changes.
