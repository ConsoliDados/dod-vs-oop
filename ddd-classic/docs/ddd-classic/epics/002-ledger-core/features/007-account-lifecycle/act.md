# FEAT-007 account-lifecycle — Act

RPA stage 3. Live task tracker (pulled from `plan.md`) + execution log + retro.

## Tasks

### A. Accounts domain — transitions as behavior
- [x] `account.aggregate.ts` — `freeze()` / `activate()` / `close()` with state-machine guards (active⇄frozen; active|frozen→closed; closed terminal); private `assertTransition(from[], to)` helper; version++ + `updateUpdatedAt()` + re-validate on each transition
- [x] `account.aggregate.spec.ts` — happy paths + illegal-transition throws per behavior

### B. Domain service + ports + error
- [x] `accounts/domain/services/close-account.service.ts` — pure (no I/O); throws `AccountNotClosableError` on non-zero balance; delegates to `account.close()`
- [x] `close-account.service.spec.ts` — zero closes; non-zero throws (no state change); already-closed propagates the transition guard
- [x] `accounts/application/ports/ledger-balance-reader.port.ts` — `balanceOf(accountId, currency): Promise<Money>`
- [x] `accounts/application/errors/account-not-closable.error.ts` — `UseCaseError`, code `ACCOUNT_NOT_CLOSABLE` → 422

### C. Accounts application — use cases
- [x] `freeze-account.usecase.ts` (load → freeze → update)
- [x] `activate-account.usecase.ts` (load → activate → update)
- [x] `close-account.usecase.ts` (load → ledger recompute → service.close → update)

### D. Ledger side — status-aware ACL + post guard
- [x] `account-lookup.port.ts` — `AccountView` gains `status`; local `AccountLookupStatus` mirror (no `accounts/domain` import)
- [x] `account-lookup.typeorm.ts` — projects `status`
- [x] `account-not-active.error.ts` — `UseCaseError`, code `ACCOUNT_NOT_ACTIVE` → 422
- [x] `post-transaction.usecase.ts` — rejects non-`active` referenced account

### E. Accounts infrastructure
- [x] `ledger-balance-reader.typeorm.ts` — `COALESCE(SUM(amountCents), 0)` over `postings` for `accountId`; returns `Money` in the requested currency
- [x] `account.controller.ts` — `PATCH /:id/freeze`, `PATCH /:id/activate`, `POST /:id/closure`
- [x] providers — `freeze-account` / `activate-account` / `close-account` use cases + `ledger-balance-reader` ACL
- [x] `accounts.module.ts` — registers the providers; imports `PostingTypeOrmEntity` in `TypeOrmModule.forFeature` for the ACL read

### F. Tests
- [x] `account.aggregate.spec.ts` extended (transitions)
- [x] `close-account.service.spec.ts` (unit)
- [x] `tests/accounts/account-lifecycle.e2e.spec.ts` — freeze/activate transitions; illegal → 422; close-at-zero 200; non-zero → 422 `ACCOUNT_NOT_CLOSABLE` (and account unchanged); post to frozen/closed → 422 `ACCOUNT_NOT_ACTIVE`; close-by-LEDGER-recompute sanity
- [x] `pnpm check` clean; `pnpm test` 83 passing (was 61 pre-FEAT-007)

### G. Docs (DoD)
- [x] SRS REQ-012/013 + REQ-006 *active* (already drafted at design time)
- [x] ADR-0010 (already drafted at design time)
- [x] `sdd-accounts.md` — transitions / domain service / `LedgerBalanceReader` port → **live**; `AccountNotClosableError` listed under §5; HTTP routes flipped from planned to live
- [x] `sdd-ledger.md` — `AccountLookup` carries `status`; `PostTransactionUseCase` rejects non-active; `AccountNotActiveError` listed under §5
- [x] `epics/002-ledger-core/README.md` — FEAT-007 exit checked, progress log entry
- [x] retro below

## Execution log

- 2026-05-28 — Branch `feat/account-lifecycle` cut off `feat/ledger-core` (after PR #3 merged). RPA approved at gate; design locked in `research.md` + ADR-0010.
- 2026-05-28 — **A:** added `freeze`/`activate`/`close` + `assertTransition` to `AccountAggregate`; 10 new aggregate spec cases (happy + illegal-transition). The behaviors mirror `reflectPosting`'s shape (guard → mutate → version++ → touch → validate).
- 2026-05-28 — **B:** `CloseAccountService` (pure, no I/O — receives the recomputed balance, doesn't read it); `LedgerBalanceReader` port; `AccountNotClosableError` (UseCaseError → 422). Service spec covers zero-closes, non-zero-throws (state unchanged), and the terminal-state guard winning on re-close.
- 2026-05-28 — **C:** three framework-free use cases (ADR-0005). `CloseAccountUseCase` instantiates the domain service inline (`new CloseAccountService()`) since it's stateless and pure — keeps the DI graph small; if it ever takes ports it'll move to a provider.
- 2026-05-28 — **D:** `AccountView` widens to `{ id, currency, status }`; `AccountLookupStatus` declared locally on the port to keep `ledger` free of `accounts/domain` (symmetric to the consumer-redeclared payload pattern in FEAT-003). `PostTransactionUseCase` rejects non-active references with `AccountNotActiveError` (422). Existing post-transaction e2e stays green — those accounts are `active`.
- 2026-05-28 — **E:** `LedgerBalanceReaderTypeOrm` does the SUM via `createQueryBuilder` (`COALESCE(SUM(amountCents), 0)`); the accounts module imports `PostingTypeOrmEntity` into `forFeature` so the read uses the same datasource — single accounts→ledger infra touch (ADR-0009 distribution seam). Controller gains 3 named-behavior endpoints (`PATCH /:id/freeze`, `PATCH /:id/activate`, `POST /:id/closure`).
- 2026-05-28 — **F:** account-lifecycle e2e covers all acceptance bullets, plus a `close-by-LEDGER-recompute sanity` case that asserts the recompute reads the ledger, not the cache. `pnpm check` clean; `pnpm test` 83 passing (was 61). Biome reformatted the long `extends CommandUseCase<...>` line on one use case.
- 2026-05-28 — **G:** SDD-accounts + SDD-ledger flipped from planned/pending to live; act.md + epic progress log written.

## Retro

- **Shipped:** rich aggregate behavior (three transitions + state-machine guards) — the foil's first non-trivial intention-revealing methods, finally exiting the anemic-with-`reflectPosting` shape. The study's **first cross-aggregate domain service** (`CloseAccountService`, ADR-0010) — and a non-contrived one, since the closeability rule honestly spans `accounts` + `ledger` and the recompute reinforces NFR-DATA-001 (cache never sole authority). A **reverse** ACL (accounts→ledger) symmetric to FEAT-002's `AccountLookup` — gives the distribution-seam (ADR-0009) a second concrete instance.
- **Decisions held:** (1) the domain service stays **pure** (takes the already-read balance), not port-aware — keeps it unit-testable without mocks and keeps cross-context reads visible at the application layer. (2) `assertTransition(from[], to)` rather than a transition table — legal edges read out at each method site (greppable). (3) `AccountLookupStatus` is **declared locally** on the ledger port, not imported from `accounts/domain` (SAD §4 invariant).
- **Surprises:** the existing post-transaction e2e stayed green without changes — those accounts are `active`, so the new guard never fires. Worth noting: a real foil regression would be silent if the e2e only used active accounts; the new e2e (`POST /transactions` against frozen/closed) closes that.
- **Punted (intentional):** transition audit trail; reason codes; reopen (`closed → active`); holds-based closeability (until REQ-004/005 land — `close` only checks the balance for now); notifications. All documented as "out" in ADR-0010.
- **What FEAT-006 will reuse:** the `LedgerBalanceReader`-style sum is the exact shape `ConsolidateAccountBalance` needs — and the **idempotency / `throughSeq` guard** that FEAT-006 will add to it is what would let the close path be safely idempotent under retries. Today the close path is one-shot.
