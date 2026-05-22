# FEAT-002 post-transaction — Act

RPA stage 3. Live task tracker (pulled from `plan.md`) + execution log + retro. Tick as work happens.

## Tasks

### 1. Domain
- [x] `domain/posting-direction.ts` (+ signed/direction helpers)
- [x] `domain/entities/posting.entity.ts`
- [x] `domain/validators/posting.validator.ts`
- [x] `domain/entities/transaction.aggregate.ts`
- [x] `domain/validators/transaction.validator.ts`
- [x] `domain/events/transaction-posted.event.ts`
- [x] co-located specs (transaction aggregate + validator, posting) green — 9 tests

### 2. Application (framework-free)
- [x] `application/ports/account-lookup.port.ts`
- [x] `application/repositories/create-transaction.repository.ts`
- [x] `application/usecases/post-transaction.usecase.ts`
- [x] `application/mappers/transaction.usecase.mapper.ts`
- [x] ledger-local not-found error. **Deviation:** dropped `CurrencyMismatchError` — postings derive currency from their account (SRS posting input has no currency), so "accounts must share currency" is the aggregate's single-currency invariant (422), not a separate use-case error.

### 3. Infrastructure
- [ ] `infrastructure/typeorm/entities/{transaction,posting}.typeorm.entity.ts`
- [ ] `infrastructure/typeorm/mappers/transaction.typeorm.mapper.ts`
- [x] `infrastructure/typeorm/repositories/create-transaction.typeorm.repository.ts` (atomic write + sequence)
- [x] `infrastructure/acl/account-lookup.typeorm.ts` (ACL into accounts, read-only)
- [x] `infrastructure/http/controllers/transaction.controller.ts` + `dtos/post-transaction.dto.ts`
- [x] `infrastructure/provider/{usecases,repositories,acl}/*.provider.ts`

### 4. Wiring
- [x] `infrastructure/ledger.module.ts`
- [x] `app.module.ts` (import LedgerModule)
- [x] `src/ledger/AGENTS.md` (module template)

### 5. Integration + close
- [x] `tests/ledger/post-transaction.e2e.spec.ts` green (happy / unbalanced 422 / single-currency 422 / missing account 404 / <2 postings 422)
- [x] draft `sdds/sdd-ledger.md` (SDD-002)
- [x] `pnpm check` + `pnpm test` green (49 tests total)
- [x] update epic `002-ledger-core/README.md` progress log

## Execution log

- 2026-05-22 — RPA cards created; plan approved (chat). User added the HTTP/API convention (behavior endpoints, not strict REST) → captured in memory + playbook before coding.
- 2026-05-22 — **Domain** done (9 specs). Signed-Money postings (credit +, debit −); `TransactionAggregate` (≥2, balanced Σ==0, single currency, throws) with `Posting` as a child entity; `TransactionPostedEvent` (plain-data entries).
- 2026-05-22 — **Application** done. `PostTransactionUseCase` (framework-free): resolves each posting's currency via the `AccountLookup` port (404 if missing) → builds the aggregate (422 if intrinsically invalid) → atomic insert → publishes `TransactionPosted` → DTO. **Deviation:** dropped `CurrencyMismatchError` — postings derive currency from their account, so "accounts must share currency" is the aggregate's single-currency invariant.
- 2026-05-22 — **Infrastructure** done. `Transaction`/`Posting` TypeORM entities (signed `bigint` cents; `sequence` = `PrimaryGeneratedColumn` monotonic order = ADR-0006 `throughSeq`); atomic `DataSource.transaction` insert; `AccountLookupTypeOrm` ACL reads the accounts table read-only (single cross-infra touch — `forFeature([…, AccountTypeOrmEntity])`); controller converts `{amount, direction}` → signed at the boundary; use case wired via `useFactory`.
- 2026-05-22 — **Integration + gates** green. 5 e2e cases; full suite 49 tests; `pnpm check` clean.

## Retro

- **Shipped**: the `ledger` context end-to-end (REQ-006, REQ-011) — balanced double-entry posting with cross-context account validation (ACL) and the `TransactionPosted` event, framework-agnostic application (ADR-0005), atomic writes, immutable postings.
- **Punted (intentional)**: balance reflection (FEAT-003), reversal (FEAT-004), list-postings (FEAT-005).
- **Surprises**: (1) the signed-Money model collapses "balanced" + "shared currency" into clean intrinsic invariants, removing a separate currency-mismatch path. (2) The cross-context read (account currency at post time) is a genuine ACL — events handle writes, but a point-in-time read needs a port; isolated to one infra file. (3) `sequence` as a `PrimaryGeneratedColumn` cleanly finalizes ADR-0006's `throughSeq`.
- **Pending**: human review at gate §16.3, then PR. Branch stacked on `feat/open-account` (PR #1 still open).
