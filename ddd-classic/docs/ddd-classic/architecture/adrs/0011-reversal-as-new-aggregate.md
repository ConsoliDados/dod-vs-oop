# ADR-0011 — Reversal as a new aggregate with a one-way link

- **Status:** Accepted
- **Date:** 2026-05-29
- **Phase / Sprint:** EPIC-002 (ledger-core) — FEAT-004 (reverse-transaction)

## Context

REQ-007 mandates `POST /transactions/:id/reversals` and REQ-011 mandates that
postings are immutable: "Once a posting is recorded it is never updated or
deleted; corrections happen via reversal (REQ-007)." Together they pin the
domain rule — a reversal is a *correction*, not an edit — but leave several
modelling decisions open: where does the reversal live (a new aggregate or
a transformation of the original?); how is it linked back (one-way on the
reversal, or denormalized on both rows?); how does it deliver its balance
effect (a special handler, or just another `TransactionPosted`?).

The shape of the answer matters because reversal is the foil's first
test of "append-only history" as a *design* and not just a database
column. Anything that nudges code toward "find the original and adjust it"
betrays REQ-011.

## Decision

1. **A reversal is a new `TransactionAggregate`.** Produced by a static
   factory `TransactionAggregate.reverseOf(original)` that mirrors each
   posting (each posting's signed `Money` is negated, fresh `Identifier`s
   are minted, `postedAt = now`). The original is **never** read for write
   — its row and its postings are byte-identical before and after.

2. **The link is one-way: only the reversal carries it.** A new optional
   field `reversedTransactionId?: string` on `TransactionAggregate` (and a
   nullable column on `transactions`) points back to the original. The
   original gains **no** `reversedBy` denormalization — writing it would
   *mutate* the original, violating REQ-011. Asking "is this transaction
   reversed?" is a query (`SELECT * FROM transactions WHERE
   reversedTransactionId = :id`), not a denormalized lookup.

3. **The reversal flows through `TransactionPosted` like any other post.**
   `ReverseTransactionUseCase` persists the reversal via the existing
   `CreateTransactionRepository` and publishes `TransactionPostedEvent`
   carrying the mirror entries (ADR-0008). `accounts`'
   `OnTransactionPostedHandler` (FEAT-003) folds the cancelling deltas
   into the cached `availableBalance` *without any special case for
   reversals* — the cache returns to its pre-original value naturally,
   and `lastPostedSeq` advances monotonically because the mirror postings
   receive fresh DB-assigned `sequence`s at insert.

4. **REQ-006 *active* applies to the reversal post.** A reversal still
   posts; the operator unfreezes / reactivates a referenced account
   before reversing if needed. Uniform with FEAT-007 — prevents "reversal
   as backdoor" around the lifecycle guard.

5. **Reverse-of-a-reversal is allowed; multiple reversals of the same id
   are allowed.** A reversal is just another transaction; capping the
   chain or rejecting duplicates would introduce stateful rules the
   ledger doesn't have. Idempotency keys are forward-looking; without
   them, double-POST produces two reversals (append-only stance).
   Recoverable by recompute (FEAT-006).

## Alternatives considered

- **(a) Mutate the original** (`originalTx.markReversed(reversal)` or set
  a `reversedAt` column). Rejected — direct violation of REQ-011. Even a
  "metadata-only" change is a write to a row whose content the SRS
  promises is immutable.
- **(b) Denormalize `reversedBy` on the original.** Rejected — same as
  (a): mutates the original. The query is cheap and the
  `WHERE reversedTransactionId = :id` lookup is the honest API.
- **(c) Aggregate method `original.reverse()` returning the new
  aggregate.** Rejected — *looks like* it mutates the receiver even if it
  doesn't. The static factory mirrors `create` / `buildExisting` and
  makes "new aggregate from another" plain.
- **(d) A subtype `ReversalTransaction extends TransactionAggregate`.**
  Rejected — a reversal *is* a transaction; inheritance adds nothing the
  link field doesn't already give us, and complicates the persistence
  shape (single-table polymorphism / discriminator) for no behavioral win.
- **(e) A bespoke `TransactionReversed` event in addition to
  `TransactionPosted`.** Rejected for the foil — the reversal already
  needs `TransactionPosted` (the cache update is identical to a normal
  post). Emitting a second event invites consumer special-casing and
  duplicates the audit signal. Revisit if a future consumer needs to
  distinguish "this post is a reversal of X" without checking
  `reversedTransactionId`.

## Consequences

- **Positive:** REQ-011 holds without effort — *no code path writes to
  an existing transaction or posting row*. The "corrections as history"
  narrative is visible in the data: two transactions, four postings, a
  one-way link. The cache update for the reversal flows through the
  existing FEAT-003 handler verbatim — fewer moving parts, fewer special
  cases. The factory mirrors `create` / `buildExisting`, keeping the
  aggregate's behavior-light intent ("no state mutation") intact.
- **Negative / scope:** "is this tx reversed?" requires a query (no
  denormalized pointer). Reverse-of-a-reversal chains can grow arbitrarily
  long — readable but unbounded. Without idempotency keys, double-POST
  silently produces two reversals — documented; forward-looking.
- **Out (gold-plating, excluded):** transition-style metadata
  (`reversedAt`, `reversalReason`); a paired `TransactionReversed` event;
  a `GET /transactions/:id/reversals` listing endpoint; idempotency keys.

## References

- REQ-007 (reverse), REQ-011 (immutability), REQ-006 (post precondition,
  *active* added in FEAT-007), NFR-DATA-001 (cache recoverable by
  recompute)
- ADR-0002 (throw-based), ADR-0003 (sync bus / cache desync — irrelevant
  on the happy path because the reversal commits before the event),
  ADR-0005 (framework-agnostic application), ADR-0006 (balance cache +
  consolidation), ADR-0008 (`TransactionPosted` carries sequence),
  ADR-0010 (status lifecycle — uniform active guard)
- FEAT-002 (`PostTransactionUseCase` — the write path reused), FEAT-003
  (`OnTransactionPostedHandler` — the handler reused verbatim), FEAT-007
  (`AccountNotActiveError` — reused for the reversal post guard)
