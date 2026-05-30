# FEAT-003 reflect-balance-on-posting — Plan

RPA stage 2. Concrete, file-by-file. Tasks flow into `act.md` as a checklist.
Decisions locked in `research.md` (gate 2026-05-26): **(A) enrich the event** (ADR-0008),
**land a thin `BalanceSnapshot` VO**.

## A. Ledger side — `TransactionPosted` carries `sequence` (ADR-0008)

1. `src/ledger/domain/events/transaction-posted.event.ts` — add `sequence: number` to `TransactionEntry` (`{ accountId, amountCents, currency, sequence }`).
2. `src/ledger/application/usecases/post-transaction.usecase.ts` — after `repo.insert` returns the **persisted** aggregate, build the published `TransactionPosted` from `tx.getPostings()` (each persisted `Posting` has `accountId`, signed `amountCents`, `currency`, `getSequence()`), entries 1:1 with postings. Publish that enriched event. Stop publishing the `create()`-time event (no `sequence`).
3. `src/ledger/domain/entities/transaction.aggregate.ts` — remove the `sequence`-less `TransactionPosted` emission from `create()` (the use case is the publisher now that the event needs a persistence fact). Keep `TransactionReversed` (FEAT-004) untouched.
4. **Tests adjust:** `transaction.aggregate.spec.ts` — drop/adjust the "emits `TransactionPosted` on create" assertion (now asserted at use-case/e2e level); `tests/ledger/post-transaction.e2e.spec.ts` stays green (response unchanged).

## B. Accounts domain

5. `src/accounts/domain/value-objects/balance-snapshot.ts` — **new** immutable VO `BalanceSnapshot` `{ accountId: string, asOf: Date, balance: Money, throughSeq: number }` (ADR-0006 shape). Smart constructor + `BalanceSnapshotValidator` (throws `InvalidValueObjectError`: `throughSeq` non-negative integer, `asOf` valid date, `balance` a `Money`). `buildExisting`/`create` per the `ValueObject` base. **Type only — no repository writes it in this slice** (persistence = FEAT-006). Co-located `balance-snapshot.spec.ts`.
6. `src/accounts/domain/entities/account.aggregate.ts`:
   - add field `lastPostedSeq: number` (checkpoint; `0` at `create()`).
   - add `reflectPosting(delta: Money, throughSeq: number): void` — assert `delta.currency === this.currency` (else throw `InvalidEntityError`/property error), assert `throughSeq > this.lastPostedSeq` (monotonic; throw otherwise), set `availableBalance = availableBalance.add(delta)`, `lastPostedSeq = throughSeq`, `version += 1`, touch `updatedAt`. Re-run validator.
   - extend `AccountSnapshot` with `lastPostedSeq`; thread through `create()` (→ 0) and `buildExisting()`.
7. `src/accounts/domain/validators/account.validator.ts` — validate `lastPostedSeq` is a non-negative integer.

## C. Accounts application

8. `src/accounts/application/repositories/update-account.repository.ts` — **new** segregated port `UpdateAccountRepository { update(account: AccountAggregate): Promise<void> }`.
9. `src/accounts/application/handlers/on-transaction-posted.handler.ts` — **new** `OnTransactionPostedHandler implements EventHandler<TransactionPostedEvent>`; ctor takes `GetAccountRepository` + `UpdateAccountRepository`. `handle(event)`: group `entries` by `accountId`; per account → `getAccount.findById` (throw `AccountNotFoundError` if absent — the account was validated at post time), compute `delta = Money.fromCents(Σ amountCents, currency)` and `throughSeq = max(sequence)` for that account, `account.reflectPosting(delta, throughSeq)`, `updateAccount.update(account)`. Framework-free (ADR-0005).

## D. Accounts infrastructure

10. `src/accounts/infrastructure/typeorm/entities/account.typeorm.entity.ts` — add `@Column({ type: 'integer', default: 0 }) lastPostedSeq!: number`.
11. `src/accounts/infrastructure/typeorm/mappers/account.typeorm.mapper.ts` — round-trip `lastPostedSeq` (`toPersistence`/`toDomain`).
12. `src/accounts/infrastructure/typeorm/repositories/update-account.typeorm.repository.ts` — **new** impl: `UPDATE ... WHERE id = :id AND version = :priorVersion` (optimistic lock; the aggregate already bumped `version`, so persist with `version - 1` as the guard); if 0 rows affected → throw a concurrency `DomainError`. Reuse `AccountTypeOrmMapper`.
13. `src/accounts/infrastructure/provider/repositories/update-account.provider.ts` — **new** Symbol token `UPDATE_ACCOUNT_REPOSITORY` + `useClass` provider.
14. `src/accounts/infrastructure/provider/handlers/on-transaction-posted.handler.provider.ts` — **new** provider constructing the handler from its ports (token `ON_TRANSACTION_POSTED_HANDLER`).
15. `src/accounts/infrastructure/accounts.module.ts` — register the update-repo + handler providers; implement `OnModuleInit` to call `eventBus.register(TransactionPostedEvent.EVENT_TYPE, handler)` once at startup. Import `TransactionPostedEvent`'s **type only** from `ledger/domain/events` for the event-type string + payload type (plain-data contract per SAD §4; no `ledger/domain` aggregate import).

## E. Tests

16. `account.aggregate.spec.ts` (extend) — `reflectPosting`: applies a signed delta to `availableBalance`; advances `lastPostedSeq`; **throws** on a non-monotonic `throughSeq` and on a currency mismatch; bumps `version`.
17. `balance-snapshot.spec.ts` (new) — happy construction + negatives (negative `throughSeq`, non-`Money` balance).
18. `tests/accounts/reflect-balance.e2e.spec.ts` (new) — open two same-currency accounts; `POST /transactions` (debit A, credit B); assert `GET /accounts/A/balance` decreased and `B` increased by the amount; both `lastPostedSeq` advanced; a third unrelated account unchanged.

## F. Docs (DoD, medium tier)

19. `architecture/adrs/0008-transaction-posted-carries-sequence.md` — **written**.
20. `architecture/sdds/sdd-accounts.md` — add the handler, `UpdateAccountRepository`, `lastPostedSeq` + `reflectPosting`, `BalanceSnapshot` VO landed; tick §7 item.
21. `architecture/sdds/sdd-ledger.md` — note `TransactionPosted` now carries `sequence`; the use case enriches post-persistence (ADR-0008).
22. `epics/002-ledger-core/README.md` — progress log entry; check the FEAT-003 `exits_with` (balance reflects via `TransactionPosted`, REQ-003 cross-context).
23. `act.md` — live checklist + execution log + retro (RPA stage 3).

## Task order

A (ledger event + use case + adjust ledger tests) → B (VO, aggregate method, validator + specs) → C (port + handler) → D (TypeORM column/mapper, update repo, providers, module registration) → E (e2e) → F (SDD/epic updates). Gate after each layer: `pnpm check`. Final: `pnpm test` green (current 49 + new specs).

## Test plan → acceptance mapping

| feature.md criterion | covered by |
|---|---|
| balance updates per affected account (REQ-003) | reflect-balance.e2e + aggregate spec |
| driven by `TransactionPosted` on the bus, no direct call | handler + module registration; e2e proves end-to-end |
| `GET /:id/balance` reflects immediately | reflect-balance.e2e |
| checkpoint advances, monotonic | aggregate spec (throws on stale) |
| unrelated account unchanged | reflect-balance.e2e |
| currency stays consistent, `version` bumps | aggregate spec |
| event carries `sequence` (ADR-0008) | ledger use-case + e2e |
| `BalanceSnapshot` VO with throwing ctor | balance-snapshot.spec |

## Risks / notes

- **Touches FEAT-002 (ledger).** The event-emission move (aggregate → use case) must keep `post-transaction.e2e` green and adjust the aggregate spec. Smallest change: build the enriched event from persisted postings; response shape unchanged.
- **Optimistic lock** on `update`: better-sqlite3 is synchronous and tests are single-threaded, so contention won't surface — the guard is for model fidelity (and the desync tradeoff below).
- **ADR-0003 desync tradeoff:** if the handler throws post-persistence the cache desyncs; recoverable by recompute (NFR-DATA-001). Not compensated in the sync foil; documented.
- **Account in two entries of one tx:** sum the net delta and take `max(sequence)` once → a single `reflectPosting`/`update` per account per event.
