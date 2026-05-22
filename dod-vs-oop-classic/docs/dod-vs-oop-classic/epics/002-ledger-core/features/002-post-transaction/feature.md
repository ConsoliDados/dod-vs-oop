---
id: FEAT-002
slug: post-transaction
container: 002-ledger-core
mode: B
status: in-review
depends-on: [FEAT-001]
blocks: [FEAT-003, FEAT-004, FEAT-005]
---

# FEAT-002 — post transaction

## Goal

Establish the `ledger` bounded context with its first slice: post a balanced
double-entry transaction across existing accounts. This is the append-only core
of the whole study (SRS §1) — every later feature (balance reflection, reversal,
listing, statements, reconciliation) builds on the postings written here. It
lands the cross-context contract for the first time: the `ledger` validates
accounts it does not own (via a port), and emits `TransactionPosted` on the
synchronous in-memory bus for `accounts` to consume in FEAT-003.

## Acceptance criteria

- [x] `POST /transactions` with `{ reference?, postings: [{ accountId, amount, direction }], metadata? }` returns 201 with the created transaction (REQ-006).
- [x] A transaction with 2+ postings whose **signed amounts sum to zero** (`Σ debits == Σ credits`) is accepted; an unbalanced one is rejected **422** (REQ-006).
- [x] All referenced accounts must **exist** and **share currency**; otherwise rejected (404 absent account / 422 single-currency invariant) (REQ-006).
- [x] A transaction with fewer than 2 postings is rejected 422.
- [x] Once recorded, a posting is **never updated or deleted** (REQ-011) — no mutation API exists; corrections are via reversal (FEAT-004).
- [x] `TransactionAggregate` cannot be constructed in an invalid state — `TransactionValidator` throws `InvalidEntityError` on the first violation (ADR-0002).
- [x] Posting the transaction emits a `TransactionPosted` domain event carrying the per-account signed amounts (consumed by `accounts` in FEAT-003).
- [x] Unit tests co-located (`transaction.aggregate.spec.ts`, `transaction.validator.spec.ts`, `posting.entity.spec.ts`); integration `tests/ledger/post-transaction.e2e.spec.ts` covering happy + unbalanced + single-currency + missing-account + <2 postings.

## Scope

**In:** `ledger` context — `TransactionAggregate` (+ `Posting` entity), `TransactionValidator`, `TransactionPostedEvent`; `PostTransactionUseCase`; `CreateTransactionRepository` (segregated) + TypeORM impl + mappers; an `AccountLookup` port (ACL into `accounts`) + impl; `TransactionController` (`POST /transactions`); `LedgerModule`; wire into `AppModule`. Reuse `Identifier` + `Money` + the `EventBus` port from `shared/`. Framework-agnostic application (ADR-0005).

**Out:** balance reflection on accounts (FEAT-003, the `TransactionPosted` handler); reversal (FEAT-004); list postings (FEAT-005); statements/reconciliation (later epics); `BalanceSnapshot`/consolidation (FEAT-006).

## RPA artefacts

- `research.md` — prior art, the double-entry/posting model, the cross-context account-validation decision, event payload, ordering key for ADR-0006, ADR candidates.
- `plan.md` — file-by-file inventory + task order + test plan.
- `act.md` — live checklist + execution log + retro.

## Branch

`feat/post-transaction` off `feat/open-account` (stacked: FEAT-002 needs FEAT-001's accounts; rebase onto `feat/ledger-core` once PR #1 merges).

## Open questions

- Cross-context account validation without importing `accounts/domain` — resolved in `research.md` (an `AccountLookup` port; ACL).
- Posting ordering key for the ADR-0006 balance checkpoint (`throughSeq`) — resolved in `research.md`.
- Whether `Posting` is its own aggregate or an entity inside `TransactionAggregate` — resolved in `research.md` (entity within the transaction).
