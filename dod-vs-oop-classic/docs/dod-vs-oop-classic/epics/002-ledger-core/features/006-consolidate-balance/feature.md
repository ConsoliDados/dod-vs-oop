---
id: FEAT-006
slug: consolidate-balance
container: 002-ledger-core
mode: B
status: in-implementation
depends-on: [FEAT-003, FEAT-007]
blocks: []
---

# FEAT-006 — consolidate account balance

## Goal

Realize ADR-0006's promise: persist the immutable, append-only
`BalanceSnapshot` audit trail that complements the recomputable cache. The
study's second cross-aggregate domain service — `ConsolidateAccountBalance`
— produces a fresh snapshot from the ledger-recomputed balance, idempotent
under `throughSeq`. Anchors NFR-DATA-001 in code: the snapshot is the
retained authority; the cache is an optimization.

## Acceptance criteria

- [x] `POST /accounts/:id/consolidations` returns **200** with the latest
  `BalanceSnapshot` (newly-appended or pre-existing on a no-op).
- [x] First call against an account with N postings appends a snapshot with
  `throughSeq = max(postings.sequence)` (or 0 if none) and
  `balance = Σ(signed amountCents)` over the ledger postings.
- [x] Second call with **no new postings** since the last snapshot is a
  no-op: no new row written; the **same** snapshot is returned.
- [x] A call after additional postings appends a new snapshot with an
  advanced `throughSeq` and the recomputed balance — strictly monotonic
  `throughSeq` across the audit trail.
- [x] **Snapshot reflects the LEDGER, not the cache** (NFR-DATA-001). If the
  cache desynced via FEAT-003's swallow-and-log path, the snapshot still
  matches Σ postings.
- [x] Unknown account id → **404** `ACCOUNT_NOT_FOUND`.
- [x] Unit (co-located): `ConsolidateAccountBalance` service — produces a
  snapshot when `throughSeq` advances; returns the existing snapshot
  unchanged when it does not. Integration:
  `tests/accounts/consolidate-balance.e2e.spec.ts` — first append, no-op
  on stale, advancing append, ledger-not-cache property, 404.

## Scope

**In:** new immutable `BalanceSnapshotTypeOrmEntity` (append-only —
no update, no soft-delete column) + bidirectional mapper; segregated
`AppendBalanceSnapshotRepository` (insert) + `GetLatestBalanceSnapshotRepository`
(read latest by accountId); new `ConsolidateAccountBalance` domain
service in `accounts/domain/services/` (pure, no I/O); `ConsolidateAccountBalanceUseCase`
(framework-free, ADR-0005); `LedgerBalanceReader` port widened to return
`{ balance, throughSeq }` (the max posting sequence summed) — minimal-blast
change; `CloseAccountUseCase` adapted to the new shape;
`POST /accounts/:id/consolidations` endpoint; `BalanceSnapshotDto`.

**Out:** changing `GET /balance` to compute from snapshot+delta (stays on
the cache path — FEAT-003 contract preserved); cold/archive tiering of old
postings (forward-looking, ADR-0006); scheduled/auto consolidation
triggers (today: on-demand only); transaction-scoped strong consistency
for the append (a snapshot is recomputable — at-most-one snapshot per
`throughSeq` per account is enforced by idempotency guard, not a uniqueness
constraint, to keep the foil minimal); transition-aware (close-emits-snapshot)
flow.

## Gate decisions (applied — heads-up was given)

1. **Trigger:** on-demand endpoint only. No scheduler; no side-effect on
   freeze/close.
2. **`GET /balance` returns the cache** — unchanged. FEAT-003 path preserved.
3. **Pure domain service** receiving the recomputed balance — no I/O. The
   use case feeds it.
4. **Idempotency = no-op** (not throw) when `throughSeq ≤ existing.throughSeq`
   — friendlier to retries.
5. **No `BalanceSnapshot` uniqueness constraint** at the DB. Idempotency is
   enforced by the service; the snapshot table accepts any append. Keeps
   the foil minimal.
