# FEAT-006 consolidate-balance — Act

RPA stage 3 (condensed). **Closes EPIC-002 in scope** — all acceptance
bullets met, all in-scope `exits_with` items checked.

## Tasks
- [x] A. Widened `LedgerBalanceReader` port + impl + `CloseAccountUseCase`
  one-line adaptation.
- [x] B. `ConsolidateAccountBalance` domain service (pure, no I/O) +
  unit spec; `AppendBalanceSnapshotRepository` + `GetLatestBalanceSnapshotRepository`
  ports.
- [x] C. `BalanceSnapshotDto` + mapper; `ConsolidateAccountBalanceUseCase`
  (framework-free; 404 via `GetAccountRepository`; reads
  `{ balance, throughSeq }` from the widened ACL; reads latest snapshot;
  delegates; appends if new).
- [x] D. `BalanceSnapshotTypeOrmEntity` (append-only schema; index on
  `(accountId, throughSeq)`) + bidirectional mapper; TypeORM repos for
  append + latest-by-account; Symbol-token providers; controller endpoint
  `POST /accounts/:id/consolidations` (always 200); `accounts.module`
  registration.
- [x] E. Unit spec (5 cases); e2e (`tests/accounts/consolidate-balance.e2e.spec.ts`,
  5 cases including the ledger-not-cache property under swallow-and-log).
- [x] F. SDD-accounts updated (§3 use case + new HTTP route + domain
  service block; §5 unchanged; §6 widened ACL + new snapshot ports +
  append-only persistence; §7 FEAT-006 ✅); epic progress + REQ exit
  checks; AGENTS.md layout refresh.
- [x] `pnpm check` clean (warnings only — pre-existing pattern from other
  features); `pnpm test` **113 passing** (was 103).

## Execution log

- 2026-05-29 — Gate decisions applied: on-demand trigger only;
  `GET /balance` unchanged; pure service; no-op idempotency; no DB unique
  constraint.
- 2026-05-29 — A: widened the port returning `{ balance, throughSeq }`
  via a single query (`COALESCE(SUM ... , 0)` + `COALESCE(MAX ..., 0)`).
  Close path adapted via destructure — single source of "ledger snapshot
  truth" instead of two read methods drifting.
- 2026-05-29 — B: domain service receives the read values; the use case
  feeds it. Idempotency rule lives at the service (no constraint =
  retries no-op instead of 500). Spec has 5 cases including a
  ledger-not-cache structural assertion (the service has no cache
  parameter — a future refactor that adds one would fail the spec).
- 2026-05-29 — C: use case orchestrates load → ACL → latest snapshot →
  service → conditional append → DTO. Always 200; the response is the
  "current" snapshot (newly appended or pre-existing on no-op).
- 2026-05-29 — D: `balance_snapshots` table has **no** `updatedAt`,
  `deletedAt`, or `version` — append-only by **schema** as well as by
  contract. Mapper mints a uuid id at write time (the VO is identity-by-value).
  Index on `(accountId, throughSeq)` supports the "latest by accountId"
  read. Controller endpoint added; module registers the new entity +
  three new providers (append repo, get-latest repo, use case).
- 2026-05-29 — E: the second `describe` in the e2e is the load-bearing
  one — overrides `UPDATE_ACCOUNT_REPOSITORY` with a throwing stub, posts
  a tx (cache stays at 0 under FEAT-003's swallow-and-log), then
  consolidates and asserts `balanceCents = 700` (the ledger truth).
  NFR-DATA-001 proven end-to-end: the snapshot is the recovery surface.

## Retro

- **Shipped:** EPIC-002's last in-scope piece. The audit trail
  promised by ADR-0006 lives in code, not just docs. The same recovery
  path the close service implies (recompute from postings) is now a
  first-class operation any consumer can invoke.
- **Decisions held (durable):** (1) **Widen the port instead of adding a
  second method** — prevents drift; the close-path adaptation cost was
  a single destructure. (2) **Idempotency at the service, not the DB** —
  retry semantics get a clean no-op instead of a constraint violation
  surfacing as 500. (3) **Cache untouched** — `OnTransactionPostedHandler`
  owns the cache; consolidate owns the snapshot; the two have separate
  failure modes and separate recovery surfaces. (4) **Append-only schema**
  — the table has no `updatedAt`/`deletedAt`/`version` columns. Trying to
  mutate would require a migration. The intention is visible at the DDL.
- **Punted (intentional, per gate):** `GET /balance` returning
  snapshot+delta (cache path stays); scheduled / side-effect-triggered
  consolidation; cold/archive tiering (ADR-0006 forward-looking);
  transaction-scoped strong consistency (a snapshot is recomputable;
  the service no-op covers retries).
- **What this teaches the DOD comparison:** the snapshot table and the
  domain service shape are part of the shared contract via NFR-DATA-001 +
  ADR-0006. The DOD side will produce a byte-identical
  `BalanceSnapshotDto` from a different layout (SoA over postings, likely
  a more compact consolidation kernel); the conformance suite gates that.
