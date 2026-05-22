# ADR-0006 — Balance as immutable snapshots + consolidation domain service

- **Status:** Accepted
- **Date:** 2026-05-22
- **Phase / Sprint:** EPIC-002 (ledger-core) — informs FEAT-003 and a follow-up consolidation feature

## Context

A ledger's source of truth is the append-only posting history (SRS NFR-DATA-001): an account's available balance is `Σ(posted postings) − holdAmount` (REQ-003). Deriving that by scanning every posting on each read is `O(n)` and does not scale as the history grows without bound — exactly the growth the study chose this domain to exercise.

Two needs pull in different directions:
- **Fast current-balance read** (O(1)-ish), for `GET /accounts/:id/balance` and as an input to other operations.
- **An auditable, retained history of consolidated balances** — a fault-intolerant financial domain must be able to answer "what was the balance as-of the March close?" and must not lose that once old postings age out.

Real institutions resolve this with **periodic consolidation (close)** and a **running balance from a checkpoint**: current = last consolidated balance (as-of T) + Σ(postings after T). Consolidation is not instantaneous; between closes the system reads the snapshot and folds the postings since. Once a period is closed and its postings are archived to cold storage, the consolidated balance becomes the retained authority for that period (you can no longer recompute from archived postings).

We must pick how `balance` is represented before FEAT-003 (which keeps balance in sync on `TransactionPosted`).

## Decision

Two distinct representations with distinct rules — **the cache overwrites, the snapshot appends**:

1. **Cached current balance on `AccountAggregate`** — the existing `availableBalance: Money` field plus a checkpoint marker of the last posting it reflects (a per-account posting sequence; exact key finalized with FEAT-002's `Posting`). It is **overwritten** incrementally on each `TransactionPosted` (FEAT-003). It is a denormalized optimization: fully recomputable, **never the sole source of truth** in an open period.

2. **`BalanceSnapshot` — an immutable Value Object / read-model**: `{ accountId, asOf, balance: Money, throughSeq }`. **Append-only**: consolidation produces a *new* snapshot; prior snapshots are never mutated or deleted. The snapshot sequence is the retained, auditable balance history.

Derivation: **current balance = latest snapshot + Σ(postings after its `throughSeq`)**.

Consolidation is a **domain service** — `ConsolidateAccountBalance` — because it spans the `accounts` and `ledger` aggregates (it reads postings and produces an account-scoped snapshot); it does not belong to a single aggregate. It must be **idempotent** and must not double-count (guarded by `throughSeq`).

Two horizons (resolves the "derivable vs authoritative" tension):
- **Open period** — postings are authoritative; balance is derived; the cache and the latest snapshot are optimizations.
- **Closed / archived period** — once postings are archived, the snapshot as-of the cut is the retained authority for that period.

### Scope for this study (granularity)

- **Implement**: the cached balance + checkpoint marker (FEAT-003); the immutable `BalanceSnapshot` VO; a **thin but real** `ConsolidateAccountBalance` domain service that produces a snapshot on demand / at period end and persists it append-only.
- **Forward-looking (documented, not implemented — like the high-precision policy in ADR-0004)**: cold/archive tiering of old postings; multi-snapshot period-close workflows beyond a single consolidation; eventual-consistency lag simulation.

## Alternatives considered

- **(a) No snapshot — derive from all postings on every read** — rejected: `O(n)` per read; the scan is the cost the study wants to *measure*, not pay on a trivial balance read.
- **(b) A single mutable `balance` record updated in place, no history** — rejected: loses auditability, contradicts the append-only ledger, and cannot answer "balance as-of T".
- **(c) `BalanceSnapshot` as a rich mutable Entity** — rejected: the behaviour (how a snapshot is produced) belongs in the consolidation domain service; the snapshot itself is an immutable record (matches the append-only, Pacioli-style nature of the ledger).
- **(d) Full event-sourcing, rebuild-on-read only** — rejected for the MVP: snapshots are the pragmatic checkpoint; pure rebuild collapses into alternative (a).

## Consequences

- **Positive**: O(1)-ish current read (snapshot + small delta); an immutable, auditable balance trail independent of the disposable cache; a clean cache story (recomputable, never authoritative alone); and a meaty, honest axis for the OOP-vs-DOD comparison — the fold-over-postings consolidation is precisely where the DOD side's SoA layout should shine.
- **Negative**: two representations of "balance" must be kept coherent — the invariant is *cache is recomputable and never authoritative alone*; consolidation must be idempotent (`throughSeq` guards double-count). More moving parts than a single field.
- **Follow-up**: FEAT-003 implements the incremental cache update + checkpoint marker; a follow-up feature implements `ConsolidateAccountBalance` + `BalanceSnapshot` persistence. The exact checkpoint key depends on FEAT-002's `Posting` shape.
- **Shared contract**: the snapshot representation and the "balance = snapshot + delta" semantics are part of the shared SRS, so the `dod-vs-oop-dod` side adopts the same model (NFR-CORRECT-001 byte-identical JSON).

## References

- `../srs.md` NFR-DATA-001 (derivable balances), REQ-003 (available balance), REQ-009 (statement opening/closing balance)
- `../sad.md` §3 (accounts owns balance), §5.5 (events trigger the cache update)
- ADR-0004 — `Money` VO (the snapshot's `balance` type) + forward-looking-policy precedent
- ADR-0003 — `TransactionPosted` is the event that drives the cache update
- ADR-0002 — throw-based; consolidation invariants throw on violation
