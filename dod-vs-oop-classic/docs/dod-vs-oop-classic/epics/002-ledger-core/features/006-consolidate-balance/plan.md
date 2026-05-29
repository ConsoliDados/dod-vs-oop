# FEAT-006 consolidate-balance — Plan

## A. ACL widening + close-use-case adaptation
1. `accounts/application/ports/ledger-balance-reader.port.ts` — replace
   `balanceOf` with `balanceAndThroughSeqOf(accountId, currency):
   Promise<{ balance: Money; throughSeq: number }>`.
2. `accounts/infrastructure/acl/ledger-balance-reader.typeorm.ts` — single
   query: `SELECT COALESCE(SUM(amountCents), 0) AS sum,
   COALESCE(MAX(sequence), 0) AS throughSeq FROM postings WHERE accountId = :id`.
3. `accounts/application/usecases/close-account.usecase.ts` — destructure
   `{ balance }` and pass to the close service.

## B. Domain service + ports + error
4. `accounts/domain/services/consolidate-account-balance.service.ts` —
   pure: inputs `(accountId, currency, ledger: { balance, throughSeq },
   latest?: BalanceSnapshot, now: Date)`; output
   `{ appended: BalanceSnapshot | undefined; current: BalanceSnapshot }`.
   No-op when `throughSeq ≤ latest.throughSeq`.
5. `accounts/domain/services/consolidate-account-balance.service.spec.ts` —
   first-snapshot, advancing, no-op cases.
6. `accounts/application/ports/append-balance-snapshot.repository.ts` —
   `append(snapshot): Promise<void>`.
7. `accounts/application/ports/get-latest-balance-snapshot.repository.ts` —
   `findLatestByAccountId(accountId): Promise<BalanceSnapshot | null>`.
8. (No new error class — `AccountNotFoundError` reused for the 404.)

## C. Use case + DTO mapper
9. `accounts/application/mappers/balance-snapshot.usecase.mapper.ts` —
   `BalanceSnapshotDto { accountId, asOf, balanceCents, currency, throughSeq }`
   + static `toDto`.
10. `accounts/application/usecases/consolidate-account-balance.usecase.ts`:
    - `GetAccountRepository.findById(id)` → 404 if absent
    - widened ACL → `{ balance, throughSeq }`
    - `GetLatestBalanceSnapshotRepository.findLatestByAccountId(id)`
    - `consolidateService.consolidate(...)` →
      `{ appended, current }`
    - if `appended` → `AppendBalanceSnapshotRepository.append(appended)`
    - return `toDto(current)`

## D. Infrastructure
11. `accounts/infrastructure/typeorm/entities/balance-snapshot.typeorm.entity.ts`
    — append-only schema; `@PrimaryColumn id`, `@Index(['accountId',
    'throughSeq'])`.
12. `accounts/infrastructure/typeorm/mappers/balance-snapshot.typeorm.mapper.ts`
    — bidirectional; `Money` via `Money.fromCents(balanceCents, currency)`.
13. `accounts/infrastructure/typeorm/repositories/append-balance-snapshot.typeorm.repository.ts`
    — `repository.insert(entity)`.
14. `accounts/infrastructure/typeorm/repositories/get-latest-balance-snapshot.typeorm.repository.ts`
    — `findOne({ where: { accountId }, order: { throughSeq: 'DESC' } })`.
15. Providers (Symbol + binding) for both repos + the use case.
16. `accounts/infrastructure/accounts.module.ts` — register the new entity
    in `TypeOrmModule.forFeature` + register the providers.
17. `accounts/infrastructure/http/controllers/account.controller.ts` —
    `@Post(':id/consolidations') @HttpCode(200)`.

## E. Tests
18. Domain service spec (B.5).
19. `tests/accounts/consolidate-balance.e2e.spec.ts`:
    - first consolidate → 200; balance = 0; throughSeq = 0 (empty postings)
    - post a tx → consolidate → 200; balance, throughSeq advance
    - consolidate again with no new postings → 200; same snapshot,
      no new row (we assert by re-consolidating and inspecting that
      throughSeq did not change)
    - simulate cache desync via the same override pattern as
      `reflect-balance-desync.e2e.spec.ts` — post a tx (cache stays at 0
      due to throwing repo); consolidate → snapshot.balance matches the
      LEDGER (not the cache); proves NFR-DATA-001
    - 404 on unknown account
20. `pnpm check` + `pnpm test` green.

## F. Docs
21. `architecture/sdds/sdd-accounts.md` — flip the FEAT-006 items to ✅;
    document `ConsolidateAccountBalance`, the snapshot port pair, and the
    `LedgerBalanceReader` widening.
22. `epics/002-ledger-core/README.md` — progress log entry; **all exits
    checked** → epic-done milestone.
23. `features/006-consolidate-balance/act.md` — execution log + retro.
24. `src/accounts/AGENTS.md` — layout tree refresh.
