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
`metadata`, `postedAt`, `reversedTransactionId?` (FEAT-004 — set only on a
reversal; one-way link, ADR-0011), plus base id/timestamps. Factories
`create(input)`, `buildExisting`, and `reverseOf(original)` (FEAT-004 — produces
a **new** aggregate with mirrored postings; the original is never touched,
REQ-011). `TransactionPosted` is built & published by `PostTransactionUseCase`
or `ReverseTransactionUseCase` from the **persisted** postings (it needs each
posting's `sequence`; ADR-0008), not emitted on `create` / `reverseOf`.

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
| `PostTransactionUseCase` | `{ reference?, metadata?, postings: [{ accountId, amountCents, direction }] }` | `TransactionDto` (201) | `TransactionAccountNotFoundError` → 404; `InvalidEntityError` (unbalanced / <2 postings / multi-currency) → 422; `AccountNotActiveError` (referenced account is `frozen`/`closed`, FEAT-007) → 422 (REQ-006 *active*) |
| `ReverseTransactionUseCase` (FEAT-004) | `{ id }` (the original's id) | `TransactionDto` (201) — the reversal, carrying `reversedTransactionId` | `TransactionNotFoundError` → 404; `TransactionAccountNotFoundError` → 404 (a posting's account vanished); `AccountNotActiveError` → 422 (any referenced account is non-`active`); `InvalidEntityError` → 422 (unreachable in practice — the validator passes on the mirror of a valid original) |

HTTP (`TransactionController`): `POST /transactions` (SRS input `{ accountId, amount, direction }`, converted to signed at the boundary); **`POST /transactions/:id/reversals`** (FEAT-004 — named-behavior subresource; produces a new mirror transaction; 201 with the reversal's DTO).

## 4. Invariants

1. A transaction has **≥ 2 postings**. *(test: aggregate + validator specs, e2e)*
2. A transaction is **balanced**: `Σ(signed cents) == 0` (`Σ debits == Σ credits`). *(test: aggregate spec, e2e)*
3. All postings of a transaction **share a single currency**. *(test: aggregate spec, e2e)*
4. Each posting moves a **non-zero** amount. *(test: posting spec)*
5. All referenced accounts **exist** and (by sharing currency, since each posting's currency is its account's) the transaction is single-currency. *(test: e2e — 404 + 422)*
6. **Postings are immutable** (REQ-011): no update/delete path; corrections are **reversals** (FEAT-004, ADR-0011 — a new aggregate via `reverseOf(original)` carrying a one-way `reversedTransactionId`; the original row + postings are byte-identical before and after). `TransactionAggregate` / `Posting` are therefore **deliberately behavior-light for state mutation** — factories + getters, no state mutators — which is the domain rule, **not** an anemic-domain smell (contrast `AccountAggregate`, whose mutable cache/status legitimately carry behavior like `reflectPosting`, `freeze`/`close`). Static factories that produce a *new* aggregate (`create`, `reverseOf`, `buildExisting`) are not mutations. Documented inline on the classes.
7. An invalid transaction/posting **cannot be constructed** — validators throw in the constructor (ADR-0002).
8. Posting amounts are whole minor units, signed, `bigint` cents (ADR-0004).

## 5. Errors

- Domain: `InvalidEntityError` (aggregate + posting validation) → **422** `{ code: 'VALIDATION_ERROR', message, fields[] }`.
- Application: `TransactionAccountNotFoundError extends UseCaseError` (code `ACCOUNT_NOT_FOUND`) → **404** via the filter's `*_NOT_FOUND` convention.
- Application: `AccountNotActiveError extends UseCaseError` (code `ACCOUNT_NOT_ACTIVE`, FEAT-007) → **422**. Raised when `AccountLookup` reports a non-`active` referenced account (REQ-006 *active* precondition; ADR-0010). **Reused** by `ReverseTransactionUseCase` — REQ-006 applies uniformly to the reversal post (ADR-0011 §4, gate 2026-05-29).
- Application: `TransactionNotFoundError extends UseCaseError` (code `TRANSACTION_NOT_FOUND`, FEAT-004) → **404** via the filter's `*_NOT_FOUND` convention. Raised by `ReverseTransactionUseCase` when the original id does not exist.

## 6. Ports / external dependencies

- **`AccountLookup` port** (`application/ports/`) — cross-context read; returns the local `AccountView { id, currency, status }` (FEAT-007 added `status`; the status union is mirrored locally as `AccountLookupStatus` — no `accounts/domain` import). Implemented by `AccountLookupTypeOrm` (ACL) reading the `accounts` table read-only — the single place ledger infra touches the accounts persistence entity. `PostTransactionUseCase` uses `status` to reject (422) a posting to a non-`active` account (REQ-006, ADR-0010).
- **`CreateTransactionRepository` port** (segregated) — atomic insert of the transaction + postings (one `DataSource.transaction`); returns the rehydrated aggregate with DB-assigned `sequence`. Bound via Symbol token in `infrastructure/provider/repositories/`. Reused verbatim by `ReverseTransactionUseCase` — a reversal is a normal posted transaction.
- **`GetTransactionRepository` port** (segregated, FEAT-004) — read a transaction by id, rehydrated with its postings in `sequence` order. Today's only consumer is `ReverseTransactionUseCase` (loads the original before mirroring). Returns `null` when absent / soft-deleted.
- **Persistence:** `TransactionTypeOrmEntity` (`transactions` — adds nullable `reversedTransactionId VARCHAR(36)` for FEAT-004) + `PostingTypeOrmEntity` (`postings`, `sequence` PK = monotonic order, signed `amountCents bigint`) + bidirectional `TransactionTypeOrmMapper`. Stack per ADR-0001.
- **Events:** publishes `TransactionPostedEvent` (plain-data `entries` `{ accountId, amountCents, currency, sequence }`, ADR-0008) via the `EventBus` port — built by `PostTransactionUseCase` **or** `ReverseTransactionUseCase` from the **persisted** postings, so each entry carries its DB `sequence`. The reversal's entries carry **negated** signed cents — the existing FEAT-003 `OnTransactionPostedHandler` folds them with no special case.
- **HTTP:** `TransactionController` (`POST /transactions`, `POST /transactions/:id/reversals`); `PostTransactionRequest` DTO (no class-validator); the reversal endpoint has no body (the id is in the URL).

## 7. Open items

- ✅ Reflect balance on `accounts` via the `OnTransactionPostedHandler` (FEAT-003, done) — `accounts` subscribes to `TransactionPosted`; ADR-0008 added `sequence` to the payload so the consumer needn't read ledger tables.
- ✅ Reverse a transaction — `POST /transactions/:id/reversals` (FEAT-004, REQ-007, ADR-0011, done): mirror postings via `TransactionAggregate.reverseOf`, one-way `reversedTransactionId` link on the reversal, original never mutated, REQ-006 *active* enforced uniformly, reversal flows through `TransactionPosted` so the cache update reuses FEAT-003 verbatim. Reverse-of-a-reversal allowed; idempotency keys forward-looking.
- List postings — `GET /accounts/:id/postings?from=&to=&limit=` (FEAT-005, REQ-008); a query repository over `postings`.
- The **signed / credit-positive convention** is a candidate ADR once the cross-implementation conformance suite lands (the DOD side must match for byte-identical JSON, NFR-CORRECT-001).
- `sequence` monotonicity relies on sqlite `INTEGER PRIMARY KEY`; revisit if the persistence/concurrency model changes.
