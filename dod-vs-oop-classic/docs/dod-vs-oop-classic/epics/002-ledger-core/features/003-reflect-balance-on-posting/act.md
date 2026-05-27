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
- [x] `pnpm check` + `pnpm test` green (60 tests)

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

## Retro

- **Shipped:** the first event **consumer** (REQ-003 cross-context) — `accounts` folds posted transactions into the cached `availableBalance` and advances the `lastPostedSeq` checkpoint, end-to-end over the sync in-memory bus. `BalanceSnapshot` VO type landed for FEAT-006 to use.
- **Decisions (gate):** enrich `TransactionPosted` with `sequence` (ADR-0008) rather than a reverse read port — keeps `accounts` from coupling to `ledger`'s tables; land a thin `BalanceSnapshot` now per the epic README.
- **Surprises:** (1) the event is now built **post-persistence** by the use case (sequence is a DB fact), a small shift from "aggregate emits its own events" — sanctioned by ADR-0008. (2) Avoiding a `ledger/domain` import on the consume side meant declaring a local inbound contract + the event-type string literal — the symmetric mirror of FEAT-002's `AccountLookup` ACL.
- **Punted (intentional):** `BalanceSnapshot` persistence + `ConsolidateAccountBalance` (FEAT-006); reversal balance effects reuse this path (FEAT-004); holds/`holdAmount` (later); the ADR-0003 desync-on-handler-failure is documented, not compensated (no Outbox in the foil).
