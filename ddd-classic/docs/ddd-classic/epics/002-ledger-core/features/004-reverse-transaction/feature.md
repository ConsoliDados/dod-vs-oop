---
id: FEAT-004
slug: reverse-transaction
container: 002-ledger-core
mode: B
status: in-implementation
depends-on: [FEAT-002, FEAT-003, FEAT-007]
blocks: []
---

# FEAT-004 — reverse a posted transaction

## Goal

Close REQ-007 (and the REQ-011 immutability promise it relies on) by adding
the ledger's correction primitive: `POST /transactions/:id/reversals` creates
a **new** transaction with mirrored postings (each signed amount negated)
linked back to the original — and the original is never mutated. Because
the reversal *is* a posted transaction, it flows through the existing
`TransactionPosted` event and FEAT-003's `OnTransactionPostedHandler`,
folding the mirror deltas back into the cached `availableBalance` without
any special-case in `accounts`. First time the foil exhibits "corrections
as append-only history."

## Acceptance criteria

- [ ] `POST /transactions/:id/reversals` creates a new transaction with
  postings that **mirror** the original (each signed `amountCents` negated)
  and returns the new `TransactionDto` with **201** (REQ-007).
- [ ] The new transaction carries a `reversedTransactionId` pointing back to
  the original; the original row + postings are byte-identical before and
  after (REQ-011 — never mutated).
- [ ] An unknown original id → **404** `TRANSACTION_NOT_FOUND` (no
  half-state is persisted).
- [ ] Reversing while any referenced account is non-`active` → **422**
  `ACCOUNT_NOT_ACTIVE` (REQ-006 *active* applies to the reversal post,
  per ADR-0010 — confirmed at gate).
- [ ] After the reversal, the affected accounts' cached `availableBalance`
  has returned to its pre-original value (the reversal flows through
  `TransactionPosted` → `OnTransactionPostedHandler` on the sync bus,
  ADR-0003), and each account's `lastPostedSeq` has advanced monotonically
  to the reversal's max posting `sequence` (ADR-0006).
- [ ] Reversing a reversal is allowed and behaves as a re-do (net-zero
  effect on balance, two extra posting rows) — confirmed at gate.
- [ ] No idempotency key today: two `POST .../reversals` calls produce two
  reversals (append-only stance). Documented; idempotency keys are
  forward-looking.
- [ ] Unit (co-located): `TransactionAggregate.reverseOf(original)` —
  mirrors postings (sign flipped per posting); preserves currency, account
  ids, and the balanced/≥2-postings invariants; captures
  `reversedTransactionId`; fresh aggregate id + fresh posting ids; reversing
  a reversal works. Integration:
  `tests/ledger/reverse-transaction.e2e.spec.ts` — happy path (post →
  reverse → balances flat); 404 on unknown id; 422 if any account is
  frozen; the original row + postings unchanged after the reversal.

## Scope

**In:**
- `TransactionAggregate.reverseOf(original) → TransactionAggregate` static
  factory (mirrored postings; carries `reversedTransactionId`); a new
  optional `reversedTransactionId` field on the aggregate + snapshot.
- `GetTransactionRepository` port + TypeORM impl (segregated; reads
  transaction + postings).
- `ReverseTransactionUseCase` (framework-free, ADR-0005) — load → active
  guard via `AccountLookup` → `reverseOf` → atomic insert → publish
  `TransactionPosted` (carrying the mirror entries; ADR-0008).
- `TransactionNotFoundError extends UseCaseError` (code
  `TRANSACTION_NOT_FOUND`) → 404.
- `TransactionTypeOrmEntity` + mapper extended for the new column.
- `TransactionController` + `POST /transactions/:id/reversals` (201).
- DI providers; SDD updates; ADR-0011 (proposed).

**Out:**
- `reversedBy` denormalization on the original (would mutate REQ-011 —
  rejected; queryable instead).
- Idempotency keys on `POST .../reversals` (forward-looking).
- Listing reversals of a given transaction (`GET .../reversals`) — not in
  the SRS. Covered by FEAT-005 list-postings shape if needed.
- Statements / reconciliation interactions — those read postings; they
  see the reversal's postings naturally (no change to those features).

## Branch

`feat/reverse-transaction` off `feat/ledger-core` (post-PR #4 merge).

## RPA artefacts

- `research.md` — prior art, current shapes, design (reversal as new
  aggregate, one-way link), tradeoffs, open questions.
- `plan.md` — file-by-file inventory + task order + test plan.
- `act.md` — live checklist + execution log + retro (at implementation).

## Open questions — for the gate

(Defaults proposed in `research.md` §"Open questions"; flip at the gate if
you disagree.)

1. Reverse-of-a-reversal allowed? → **default: yes**.
2. Same-day double-reversal idempotency? → **default: allow multiple**;
   idempotency keys forward-looking.
3. Reversal's `reference` text? → **default: `Reversal of <original.ref>`
   when present, else `undefined`**.
4. Active guard applies to the reversal post? → **default: yes**.
5. ADR-0011 (proposed) needed? → **default: yes**.
