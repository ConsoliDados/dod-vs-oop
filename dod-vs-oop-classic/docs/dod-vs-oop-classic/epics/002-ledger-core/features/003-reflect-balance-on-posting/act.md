# FEAT-003 reflect-balance-on-posting — Act

RPA stage 3. Live task tracker (pulled from `plan.md`) + execution log + retro.

## Tasks

### A. Ledger — event carries `sequence` (ADR-0008)
- [x] `TransactionEntry` + `sequence` in `transaction-posted.event.ts`
- [x] `PostTransactionUseCase` builds the enriched event from persisted postings
- [x] `transaction.aggregate.ts` — stop emitting `TransactionPosted` at `create()`; `toEntries()` requires persisted postings
- [x] `transaction.aggregate.spec.ts` adjusted; `post-transaction.e2e.spec.ts` stays green

### B. Accounts domain
- [x] `balance-snapshot.ts` VO + `balance-snapshot.spec.ts`
- [x] `account.aggregate.ts` — `lastPostedSeq` + `reflectPosting()` + `AccountSnapshot`
- [x] `account.validator.ts` — validate `lastPostedSeq`
- [x] `account.aggregate.spec.ts` — `reflectPosting` cases

### C. Accounts application
- [x] `update-account.repository.ts` port
- [x] `on-transaction-posted.handler.ts` (local inbound contract; no `ledger/domain` import)

### D. Accounts infrastructure
- [x] `account.typeorm.entity.ts` — `lastPostedSeq` column
- [x] `account.typeorm.mapper.ts` — round-trip
- [x] `update-account.typeorm.repository.ts` — optimistic lock
- [x] providers (update repo + handler)
- [x] `accounts.module.ts` — register handler on `onModuleInit`

### E. Tests
- [x] `tests/accounts/reflect-balance.e2e.spec.ts`
- [x] `tests/accounts/reflect-balance-desync.e2e.spec.ts` (swallow-and-log demonstrates ADR-0003 desync explicitly)
- [x] `pnpm check` + `pnpm test` green (61 tests)

### G. Review follow-up (swallow-and-log refinement)
- [x] `OptimisticLockError extends DomainError` in `accounts/application/errors/`
- [x] `Logger` port in `shared/application/` + `ConsoleLogger` impl + `LOGGER` provider in `SharedModule`
- [x] `OnTransactionPostedHandler` — per-account `try/catch` → `logger.warn(accountId, cause)` → continue; never rethrows
- [x] `UpdateAccountTypeOrmRepository` — throws `OptimisticLockError` (replaces bare `Error`)
- [x] ADR-0003 Consequences amended (refinement for the recomputable-cache path) + handler doc-comment + `sdd-accounts.md`

### F. Docs
- [x] `sdd-accounts.md` + `sdd-ledger.md`
- [x] epic `002-ledger-core/README.md` progress + exit
- [x] ADR-0008 (written at plan stage)
- [x] retro below

## Execution log

- 2026-05-27 — Act started; RPA (research + plan) approved at gate. Branch `feat/reflect-balance-on-posting`.
- 2026-05-27 — **Ledger (ADR-0008):** added `sequence` to `TransactionEntry`; `toEntries()` now requires persisted postings (throws otherwise); moved `TransactionPosted` emission out of `create()` — `PostTransactionUseCase` builds it from the persisted aggregate and publishes. Adjusted the aggregate spec.
- 2026-05-27 — **Accounts:** `BalanceSnapshot` VO (smart constructor, throw) + spec; `AccountAggregate.reflectPosting(delta, throughSeq)` + `lastPostedSeq` field + validator; `UpdateAccountRepository` port + TypeORM impl (optimistic-lock guard on prior `version`); `OnTransactionPostedHandler` declaring a **local** inbound contract (no `ledger/domain` import, symmetric to the `AccountLookup` ACL); providers + `onModuleInit` registration.
- 2026-05-27 — **Gates green** after fixing: a missed `AccountSnapshot` literal in `account.validator.spec`, a wrong relative import path in the module (`./` → `../application`), and a `noConfusingVoidType` warning (dropped the `Output = void` alias). `pnpm check` clean; `pnpm test` 60 passing (was 49).
- 2026-05-28 — **Code-review follow-up: swallow-and-log on the cross-context cache path.** The handler + the `UpdateAccount` repo could bubble to the `POST /transactions` request (HTTP 500) on a cache-update failure — wrong for a recomputable cache (NFR-DATA-001). Replaced the bare `throw new Error` with a typed `OptimisticLockError extends DomainError`; added a minimal `Logger` port (`shared/application/logger.ts`) + a `ConsoleLogger` impl + `LOGGER` token in `SharedModule`; `OnTransactionPostedHandler` now wraps each affected account in `try/catch`, logs a warning with `accountId` + `cause`, and continues — **never rethrowing to the producer**. Wrote the desync e2e (`tests/accounts/reflect-balance-desync.e2e.spec.ts`): override `UpdateAccountRepository` with a stub that throws, override `LOGGER` with a spy, assert `POST /transactions` is still 201, both balances stay stale, and the warning fired per affected account. Hardened the happy-path `reflect-balance.e2e.spec.ts` bystander assertion (gave it a prior non-zero balance before the unrelated post). Doc corrections: `sdd-ledger.md` (§3 error row + §6 `AccountLookup` bullet — FEAT-007 marked **planned/pending**, not shipped); `transaction-posted.event.ts` doc-comment (event built post-persistence by the use case, not at `aggregate.create()`); ADR-0006 (`throughSeq` = **global** posting sequence, finalized FEAT-002); SAD §4 (cross-context payload pattern — producer-owned in `domain/events/` + consumer-redeclared local contract, invariant is *no cross-context import*); feature.md acceptance bullet (checkpoint monotonicity = unit-tested, not asserted over HTTP). `pnpm check` clean; `pnpm test` 61 passing (was 60).

## Retro

- **Shipped:** the first event **consumer** (REQ-003 cross-context) — `accounts` folds posted transactions into the cached `availableBalance` and advances the `lastPostedSeq` checkpoint, end-to-end over the sync in-memory bus. `BalanceSnapshot` VO type landed for FEAT-006 to use.
- **Decisions (gate):** enrich `TransactionPosted` with `sequence` (ADR-0008) rather than a reverse read port — keeps `accounts` from coupling to `ledger`'s tables; land a thin `BalanceSnapshot` now per the epic README.
- **Surprises:** (1) the event is now built **post-persistence** by the use case (sequence is a DB fact), a small shift from "aggregate emits its own events" — sanctioned by ADR-0008. (2) Avoiding a `ledger/domain` import on the consume side meant declaring a local inbound contract + the event-type string literal — the symmetric mirror of FEAT-002's `AccountLookup` ACL.
- **Punted (intentional):** `BalanceSnapshot` persistence + `ConsolidateAccountBalance` (FEAT-006); reversal balance effects reuse this path (FEAT-004); holds/`holdAmount` (later); the ADR-0003 desync-on-handler-failure is documented, not compensated (no Outbox in the foil).

### Retro addendum (2026-05-28, post-review)

- **Refinement landed:** swallow-and-log on the cross-context cache update — a narrow, documented exception to ADR-0003's blanket "handler errors propagate" rule, scoped to the recomputable-cache path. The cached `availableBalance` is recomputable and the immutable `BalanceSnapshot` trail is untouched by this path (ADR-0006), so letting a cache hiccup fail `POST /transactions` would silently lose the *posting* — strictly worse than a transient desync recoverable by FEAT-006.
- **Greppable failure mode:** typed `OptimisticLockError extends DomainError` replaces the bare `Error`. The handler catches `Error` broadly (any infra blip is swallowed-and-logged), but the *raise* site is now structured + searchable; tests assert the `cause` surface in the logged context.
- **Logger port:** minimal `{ warn, error, info }` interface in `shared/application/`, console-backed impl wrapping NestJS `Logger` in `shared/infrastructure/logger/`. Kept tiny on purpose — just enough to surface the swallow-and-log telemetry from a framework-agnostic application layer (ADR-0005). Tests override the provider with a spy.
- **Desync test promised by the epic README is now real:** `reflect-balance-desync.e2e.spec.ts` proves the trade-off rather than describing it — POST still 201, balances stale, warning fired per affected account, `OptimisticLockError` visible in `cause`.
- **Open ratchet:** when FEAT-006 lands, this test should be extended to demonstrate recovery (`ConsolidateAccountBalance` recomputes the cached balance from the postings and the desync resolves). The current test stops at "observable desync" + "source-of-truth (postings) persisted in the same DB tx".
