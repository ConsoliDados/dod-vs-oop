# FEAT-006 consolidate-balance — Research (condensed)

## Sources / prior art
- **ADR-0006** — balance has two representations: the cache (overwrites) +
  the snapshot (appends). Current = latest snapshot + Σ(postings after
  `throughSeq`).
- **FEAT-003** — `BalanceSnapshot` VO type landed; persistence + the
  consolidation domain service deferred to here.
- **FEAT-007** — `LedgerBalanceReader` ACL exists; sums signed
  `amountCents` for an account. Today returns only `Money`.
- **NFR-DATA-001** — postings are the source of truth; cache is an
  optimization.

## Current state
- `BalanceSnapshot` VO with smart constructor + spec.
- `LedgerBalanceReader` returns only `Money` — no `throughSeq`.
- No `balance_snapshots` table.
- No domain service yet for consolidation.

## Decisions
1. **Widen `LedgerBalanceReader` to `balanceAndThroughSeqOf(accountId,
   currency) → { balance: Money; throughSeq: number }`.** Removes the
   convenience name `balanceOf`. The close use case adapts to the new
   shape (cosmetic). Single source of "ledger snapshot truth" prevents
   two-method drift.
2. **Domain service `ConsolidateAccountBalance`** in
   `accounts/domain/services/` (next to `CloseAccountService`). Pure, no
   I/O. Inputs: `accountId`, `currency`, current `{ balance, throughSeq }`
   from the ledger, and the prior latest snapshot (or undefined). Output:
   either a new `BalanceSnapshot` to append, **or** the existing snapshot
   when `throughSeq ≤ existing.throughSeq` (no-op for retries).
3. **`BalanceSnapshotTypeOrmEntity`** — append-only schema: `(id PK,
   accountId, asOf, balanceCents bigint, currency, throughSeq,
   createdAt)`. No `updatedAt`, no `deletedAt`, no version column. Index on
   `(accountId, throughSeq DESC)` for the "latest by accountId" read.
   Idempotency lives in the service, not as a DB unique constraint, so a
   retry races a no-op rather than a constraint violation.
4. **Use case** — `accounts/application/usecases/`. Loads the account
   (404 via `GetAccountRepository`), reads `{ balance, throughSeq }` via
   the widened ACL, reads the latest snapshot (or null), calls the
   service, persists if a new snapshot was produced, returns the DTO.
5. **HTTP** — `POST /accounts/:id/consolidations` on the existing
   `AccountController`. 200 always (newly-appended or no-op). DTO carries
   `{ accountId, asOf, balanceCents, currency, throughSeq }`.

## Tradeoffs considered
- **Widening `LedgerBalanceReader` vs adding a second method.** Widened —
  prevents drift between "balance only" and "balance + sequence" reads;
  the close path's one-line adaptation is cheap.
- **Idempotency: no-op vs throw vs always-append.** No-op chosen — retry
  semantics; `throw` would force callers to distinguish "stale" from
  "real" failures; always-append bloats the audit trail without value.
- **Uniqueness constraint on `(accountId, throughSeq)` at the DB.**
  Rejected — the service guards idempotency; a constraint would turn a
  race into a 500. The foil prefers the service-level rule.
- **Updating the cache during consolidate.** Rejected — the cache is
  `OnTransactionPostedHandler`'s responsibility; cross-write introduces
  ordering questions. The snapshot is the recovery surface.
