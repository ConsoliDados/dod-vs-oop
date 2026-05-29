# FEAT-004 reverse-transaction — Research

RPA stage 1. Prior art, current state, options, decisions. Feeds `plan.md`.

## Sources / prior art

- **REQ-007** — "`POST /transactions/:id/reversals` creates a new transaction
  with mirrored postings; the original is never mutated."
- **REQ-011** — posting immutability: "Once a posting is recorded it is never
  updated or deleted; corrections happen via reversal (REQ-007)."
- **FEAT-002 `PostTransactionUseCase` / `TransactionAggregate`** — the
  append-only write path. Reused wholesale by the reversal: a reversal is
  *just another posted transaction*, persisted by the same atomic
  `CreateTransactionRepository` and emitting the same `TransactionPosted`
  event (so `accounts`' `OnTransactionPostedHandler` folds the mirror deltas
  through the existing FEAT-003 path — no new handler needed).
- **FEAT-007 `AccountLookup`** — gained `status` and the *active*
  precondition. A reversal still **posts**; the same guard applies (open
  question §4 below).
- **ADR-0008** — `TransactionPosted` carries each posting's `sequence`
  assigned at persistence. A reversal's mirrored postings get **fresh**
  sequences (each is its own historical fact), so the consumer reflects them
  through the normal monotonic-checkpoint path.

## Current state (verified)

- `TransactionAggregate` has `id`, `reference?`, `postings`, `metadata`,
  `postedAt`. **No** link field. Factories `create(input)` + `buildExisting`.
  Deliberately behavior-light getters-only (sdd-ledger §4 invariant 6) — but
  that's about *state mutation*, not about producing related aggregates.
- `Posting` is immutable (signed `Money`, no setters). `sequence` is DB-assigned.
- `CreateTransactionRepository.insert(...)` writes transaction + postings
  atomically and returns the rehydrated aggregate with sequences.
- **No `GetTransactionRepository` port yet** — FEAT-002 only posts. The
  reversal needs to read the original first.
- `TransactionController` has only `POST /transactions`.
- `transactions` table has no link column. `postings` carries a signed
  `amountCents` — a mirror just persists the negated sign.

## Design

### 1. Reversal is a new aggregate, not a mutation

A reversal is a **fresh `TransactionAggregate`** with mirrored postings (each
posting's signed `Money` negated). The original is never touched — its row
and its postings stay byte-identical (REQ-011). The link between the two
lives **only on the reversal**:

- new field `reversedTransactionId?: string` on `TransactionAggregate`
- new column `reversedTransactionId VARCHAR(36) NULL` on `transactions`
- the original carries no `reversedBy` denormalization → writing it would
  *mutate* the original, violating REQ-011

Querying "is this transaction reversed? by what?" is a `WHERE
reversedTransactionId = :id` query (FEAT-005-shaped read; covered if/when
needed). Not denormalized today.

### 2. Aggregate-level factory: `TransactionAggregate.reverseOf(original)`

Static factory (a *production* of a new aggregate, not a state change). It:

- builds new `Posting`s by **negating each original posting's signed `Money`**
- carries the original's `reference` enriched with a hint (e.g.
  `Reversal of <originalRef>`) or none if the original had no reference —
  decided in plan
- sets `reversedTransactionId = original.id`
- fresh `id`, fresh `postedAt = now`, fresh `Identifier`s on the postings
- runs the same validator → still balanced (Σ(-x) over a zero-sum set is
  zero), still ≥ 2 postings, still single-currency

The aggregate stays "deliberately behavior-light *for state mutations*";
factories that emit a new aggregate are not mutations and are idiomatic
(`create` already exists; `reverseOf` joins it).

### 3. Use case orchestration

`ReverseTransactionUseCase(getTransaction, createTransaction, accountLookup, eventBus)`:

1. **Load original** via the new `GetTransactionRepository.findById(originalId)` → 404
   `TRANSACTION_NOT_FOUND` if absent.
2. **For each account on the original**, call `accountLookup.findById(accountId)`:
   - absent → 404 `ACCOUNT_NOT_FOUND` (`TransactionAccountNotFoundError`)
   - non-`active` → 422 `ACCOUNT_NOT_ACTIVE` (reused
     `AccountNotActiveError`), iff we keep the active guard on reversal
     (open question §4).
3. `TransactionAggregate.reverseOf(original)` (validator runs; throws if the
   original was somehow malformed — unreachable in practice).
4. `createTransactionRepository.insert(reversal)` — atomic; postings get
   fresh `sequence`s.
5. Build & publish `TransactionPostedEvent` from the persisted reversal
   (ADR-0008) — the cache updates **through the existing FEAT-003 handler**
   on the synchronous bus. No new handler; no special-case for reversals.
6. Return the reversal's `TransactionDto`.

### 4. Persistence

- Add nullable `reversedTransactionId` to `TransactionTypeOrmEntity` +
  bidirectional mapper.
- `GetTransactionTypeOrmRepository.findById` reads the transaction row +
  postings (`WHERE transactionId = :id ORDER BY sequence ASC`) and rebuilds
  via `TransactionTypeOrmMapper.toDomain`.
- `CreateTransactionTypeOrmRepository` unchanged — the mapper now writes
  the new column.

### 5. HTTP

`POST /transactions/:id/reversals` → 201 with the **reversal's**
`TransactionDto` (REQ-007 wording: "creates a new transaction"). The DTO
also surfaces `reversedTransactionId` so clients can link them.

### 6. Event flow — why nothing else changes

The reversal publishes `TransactionPosted` (carrying the mirror entries).
`accounts`' `OnTransactionPostedHandler` (FEAT-003) folds those entries the
same way it folds an original transaction. Because mirror entries have
signed amounts negated, the net per-account delta cancels the original →
cached `availableBalance` returns to its pre-original state, and
`lastPostedSeq` advances to the reversal's max sequence (monotonic, since
sequences are append-only and globally increasing).

## Tradeoffs considered

- **Static factory `reverseOf` vs aggregate method** (`original.reverse()`):
  chose factory — a method on the original could *look like* it mutates;
  factory makes the "new aggregate" plain. Mirrors the
  `create`/`buildExisting` pair.
- **Pass `accountLookup` to the aggregate** — rejected: aggregate stays
  framework-free (ADR-0005) and doesn't read other contexts. Active guard
  lives in the use case (consistent with `PostTransactionUseCase`).
- **Denormalize `reversedBy` on the original** — rejected: a write to the
  original is a mutation (REQ-011). Query if/when needed.
- **Special "Reversal" subtype** — rejected: a reversal *is* a transaction;
  inheritance adds nothing the link field doesn't already give us.
- **Idempotency key on the request** — out of scope today; documented as
  forward-looking (see open question §3).

## ADR candidate

**ADR-0011 (proposed): Reversal as a new aggregate with a one-way link.**
Captures the decisions above:
- a reversal is a new immutable `TransactionAggregate` carrying
  `reversedTransactionId`;
- the original is never updated (REQ-011 hardness);
- the link is **one-way** (on the reversal only — no `reversedBy` on the
  original);
- the reversal flows through `TransactionPosted` like any other post — no
  special handler in `accounts`.

## Open questions — for the gate

1. **Reverse-of-a-reversal allowed?**
   - Default proposal: **yes** — a reversal is just another transaction;
     reversing it produces a (net-zero w.r.t. balance) re-do. No business
     reason to prohibit in the foil.
   - Alternative: prohibit (cap chains at one). Adds a guard
     (`if (original.reversedTransactionId) throw`) but constrains semantics.

2. **Same-day double-reversal idempotency?**
   - Default proposal: **allow multiple** — append-only stance; each
     reversal is its own historical fact. The cache desyncs to net zero +
     one-extra-pair if accidentally reversed twice — recoverable by
     consolidation (FEAT-006).
   - Alternative: reject if a reversal already exists for `:id` (one-shot).
   - Forward-looking: idempotency keys on the request — out of scope.

3. **Reversal carries the original's `reference`?**
   - Option A (proposed): **yes, prefixed** — `Reversal of <originalRef>`
     when the original had one; otherwise `undefined`.
   - Option B: copy as-is.
   - Option C: always `undefined` (don't synthesize text).
   Cosmetic; affects client display.

4. **Active guard applies to reversal?**
   - Default proposal: **yes** — REQ-006 *active* is uniform; the operator
     activates/unfreezes before reversing if needed. Consistent with the
     post path.
   - Alternative: exempt reversals (corrections, not new business). Risks
     "reversal as backdoor" around the lifecycle guard.

5. **ADR-0011 needed, or fold into SDD?**
   - Default proposal: **yes, write ADR-0011** — the "one-way link" +
     "original never updated" decisions are lock-in worth recording
     alongside ADR-0010/ADR-0008.
