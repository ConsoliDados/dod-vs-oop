---
id: SDD-001
title: accounts
status: draft
date: 2026-05-21
---

# SDD-001 — accounts

> Tactical design of the `accounts` bounded context. Companion to `sad.md` §3.
> Verbose-canonical OOP style (Evans/Vernon), **throw-based** (ADR-0002), not the
> template's `Result`/free-function default. Reflects the state after FEAT-001
> (open-account); holds lifecycle and event-driven balance are later features.

## 1. Bounded context / area

Owns the account lifecycle: opening an account and reading it and its available
balance (REQ-001/002/003). Lives in `src/accounts/` as a NestJS module
(`domain/` → `application/` → `infrastructure/`). Depends only on `src/core/`
(DDD building blocks) and `src/shared/` (`Identifier`, `Money`, `InMemoryEventBus`).
It never imports another context's `domain/`; cross-context contact is via domain
events on the synchronous in-memory bus (no Outbox — ADR-0003).

## 2. Aggregates / domain types

**`AccountAggregate`** (root) — fields:

| Field | Type | Notes |
|-------|------|-------|
| `id` | `Identifier` | UUID, from `src/shared` |
| `ownerId` | `string` | non-empty |
| `currency` | `Currency` | ISO-4217 subset; single-currency per account |
| `status` | `AccountStatus` | `active \| frozen \| closed`; only `active` produced in FEAT-001 |
| `availableBalance` | `Money` | integer minor units (cents); starts `0` |
| `holdAmount` | `Money` | cents; starts `0`; non-negative |
| `version` | `number` | optimistic-lock counter; non-negative integer |
| `lastPostedSeq` | `number` | balance checkpoint: highest posting `sequence` folded into `availableBalance` (ADR-0006); starts `0`, advances monotonically via `reflectPosting` (FEAT-003) |
| `createdAt/updatedAt/deletedAt` | `Date` | base `Entity`; soft delete via `deletedAt` |

Factories: `create(ownerId, currency)` (new account, emits `AccountOpenedEvent`)
and `buildExisting(snapshot)` (rehydrate from a persisted row; re-validates).
Both run `AccountValidator` in the constructor, so an invalid instance can never
exist.

Supporting types: `AccountStatus` (string union), `AccountSnapshot`
(reconstruction shape), `AccountDto` (client representation; money as cents).

**Balance model (ADR-0006):** the `availableBalance` field above is a recomputable
**cache**, overwritten on each `TransactionPosted` via `reflectPosting` and carrying
the `lastPostedSeq` checkpoint of the last posting it reflects (**landed FEAT-003**).
The audit trail is a separate immutable VO **`BalanceSnapshot`** `{ accountId, asOf,
balance: Money, throughSeq }` — the **type** lands FEAT-003; its append-only
persistence + the `ConsolidateAccountBalance` domain service are FEAT-006. Current
balance = latest snapshot + Σ(postings after `throughSeq`). **Rule: the cache
overwrites, the snapshot appends.**

## 3. Use cases / operations

Use cases are **framework-free plain classes** whose constructor takes ports
(see §6, ADR-0005); `execute()` returns the response directly and failures
propagate as **thrown** exceptions (ADR-0002), mapped to HTTP by
`DomainExceptionFilter`.

| Operation | Input | Output | Errors (thrown) |
|-----------|-------|--------|-----------------|
| `OpenAccountUseCase` | `{ ownerId, currency }` | `AccountDto` (201) | `InvalidEntityError` / `InvalidValueObjectError` → 422 |
| `GetAccountUseCase` | `{ id }` | `AccountDto` (200) | `AccountNotFoundError` → 404 |
| `GetBalanceUseCase` | `{ id }` | `{ availableBalance: number, currency }` (200) | `AccountNotFoundError` → 404 |
| `FreezeAccountUseCase` (FEAT-007) | `{ id }` | `AccountDto` (200) | `AccountNotFoundError` → 404; `InvalidEntityError` (illegal transition) → 422 |
| `ActivateAccountUseCase` (FEAT-007) | `{ id }` | `AccountDto` (200) | `AccountNotFoundError` → 404; `InvalidEntityError` → 422 |
| `CloseAccountUseCase` (FEAT-007) | `{ id }` | `AccountDto` (200) | `AccountNotFoundError` → 404; `AccountNotClosableError` (non-zero ledger balance) → 422; `InvalidEntityError` (already closed) → 422 |
| `ConsolidateAccountBalanceUseCase` (FEAT-006) | `{ id }` | `BalanceSnapshotDto` (200) — newly-appended or pre-existing on a no-op | `AccountNotFoundError` → 404 |

HTTP surface (`AccountController`): `POST /accounts`, `GET /accounts/:id`,
`GET /accounts/:id/balance`, **`PATCH /accounts/:id/freeze`**,
**`PATCH /accounts/:id/activate`**, **`POST /accounts/:id/closure`** (FEAT-007 —
named-behavior endpoints, not REST CRUD), **`POST /accounts/:id/consolidations`**
(FEAT-006 — append a `BalanceSnapshot`; idempotent).

**Event subscriber (FEAT-003):** `OnTransactionPostedHandler` reacts to `ledger`'s
`TransactionPosted` on the synchronous in-memory bus — per affected account it folds
the net signed delta into `availableBalance` and advances `lastPostedSeq` via
`reflectPosting`, persisting through `UpdateAccountRepository`. Framework-free
(ADR-0005); registered with the bus in `accounts.module.ts` `onModuleInit`. Reads
the inbound payload as a locally-declared contract, never importing `ledger/domain`.

**Swallow-and-log on the recomputable-cache path** (refines ADR-0003 for FEAT-003).
Each account is processed in its own `try/catch`; a failure
(`OptimisticLockError`, absent account, infra blip) is **logged as a warning**
with the `accountId` + `cause` via the `Logger` port, and the handler **continues
to the next account** — it never rethrows to the producer. Rationale: the cached
balance is recomputable (NFR-DATA-001) and the immutable `BalanceSnapshot`
audit trail (ADR-0006) is untouched by this path, so letting a cache hiccup fail
`POST /transactions` (HTTP 500) would silently lose the *posting* — strictly
worse than a transient desync recoverable by recompute (FEAT-006). The
`UpdateAccountRepository` impl raises a typed `OptimisticLockError extends
DomainError` (greppable, structured) on a stale `version` guard. Tested
explicitly in `tests/accounts/reflect-balance-desync.e2e.spec.ts`. A real
production deployment would back this with a retry queue / Outbox.

**Domain service (FEAT-006, ADR-0006) — `ConsolidateAccountBalance`.** Pure
(no I/O). Receives the ledger-recomputed `{ balance, throughSeq }` and the
prior latest snapshot (or undefined); decides append-vs-no-op based on
`throughSeq` monotonicity. The use case feeds it the reads — the service is
unit-testable without mocks. **The cache is not touched here** — that's
`OnTransactionPostedHandler`'s responsibility (ADR-0006: *the cache
overwrites, the snapshot appends*). Idempotency is enforced at the service
layer (no DB unique constraint) so retries no-op rather than 500.

**Status transitions (FEAT-007, ADR-0010) — aggregate behavior.** `freeze()`,
`activate()`, `close()` on `AccountAggregate` are intention-revealing methods,
each under a transition guard (private `assertTransition`). Legal edges:
`active ⇄ frozen`; `active | frozen → closed`; `closed` is terminal. An illegal
transition throws `InvalidEntityError` (→ 422). Each transition bumps `version`
(optimistic lock) and `updatedAt`, then re-runs the validator. **Not a setter,
not a generic `update()`.**

**Domain service (FEAT-007, ADR-0010) — `CloseAccountService`.** Pure (no I/O).
The rule "close only at a zero ledger-recomputed balance" spans `accounts` (the
aggregate) **and** `ledger` (the recomputed balance), so it doesn't belong on
either aggregate. The use case reads the balance from the `LedgerBalanceReader`
ACL and passes it to the service; the service throws `AccountNotClosableError`
(→ 422) on a non-zero balance, or delegates the transition to `account.close()`.
The *decision* spans contexts (service); the *transition* stays on the aggregate.

## 4. Invariants

1. `ownerId` is a non-empty string. *(test: `account.validator.spec.ts`, `account.aggregate.spec.ts`)*
2. `status ∈ { active, frozen, closed }`. *(test: validator spec — unknown status throws)*
3. `availableBalance` and `holdAmount` share the account's `currency`. *(enforced by validator)*
4. `holdAmount` is non-negative; `version` is a non-negative integer. *(test: validator accumulation spec)*
5. An invalid `AccountAggregate` cannot be constructed — the validator throws inside the constructor (ADR-0002). *(test: every negative aggregate spec)*
6. A freshly opened account has zero balances, `active` status, version 0, and emits exactly one `AccountOpenedEvent`. *(test: aggregate create spec + e2e)*
7. Money is whole minor units everywhere (no float); persisted as `bigint` cents (ADR-0004).

## 5. Errors

- Domain: `InvalidEntityError` (aggregate validation), `InvalidValueObjectError`
  (e.g. unsupported currency via `Money`), `InvalidIdentifierError` — all
  subclasses of `DomainError` → **422** with `{ code: 'VALIDATION_ERROR', message, fields[] }`.
- Application: `AccountNotFoundError extends UseCaseError` (code `ACCOUNT_NOT_FOUND`)
  → **404**. The filter's `*_NOT_FOUND` convention drives the status.
- Application: `AccountNotClosableError extends UseCaseError` (code
  `ACCOUNT_NOT_CLOSABLE`, FEAT-007) → **422**. Raised by `CloseAccountService`
  when the ledger-recomputed balance is non-zero (the *precondition* — the
  transition itself stays legal).
- Repository: `OptimisticLockError extends DomainError` (FEAT-003) — raised by
  `UpdateAccountRepository` impls when the prior-`version` guard matches zero
  rows. **Caught inside the cross-context cache handler** (swallow-and-log; see
  §3 / ADR-0003 refinement); never reaches the HTTP filter today.

> **Framework-agnostic application (ADR-0005)**: `domain/` + `application/` are
> plain TypeScript. Use cases are plain classes whose constructor takes the ports
> below; all NestJS wiring (Symbol tokens + providers) lives in
> `infrastructure/provider/{usecases,repositories}/`, and the module in
> `infrastructure/accounts.module.ts`. The infra layer is swappable (Elysia/Bun).

- **Repository ports (segregated, playbook §5):** `CreateAccountRepository`
  (`insert`), `GetAccountRepository` (`findById`, filters `deletedAt IS NULL`),
  `UpdateAccountRepository` (`update`, optimistic-lock guard on the prior `version`;
  FEAT-003) — interfaces in `application/repositories/`. Bound to TypeORM impls via
  Symbol tokens in `infrastructure/provider/repositories/` (`useClass`).
- **EventBus port:** `src/shared/application/event-bus.ts` (`EventBus`);
  use cases depend on the port, never the impl.
- **Logger port** (`src/shared/application/logger.ts`, FEAT-003) — minimal
  framework-agnostic `{ warn, error, info }` interface. Used by
  `OnTransactionPostedHandler` to surface the swallow-and-log warning on a
  failed cache update. Impl `ConsoleLogger` (wraps NestJS `Logger`) wired via
  `LOGGER` token in `SharedModule` (`@Global`); tests override the provider
  with a spy.
- **`LedgerBalanceReader` port** (`application/ports/`, FEAT-007 — **live**,
  widened in FEAT-006 to return `{ balance, throughSeq }`) — cross-context
  read (accounts→ledger ACL): the account's balance summed from the ledger
  posting history (`Money`, in the requested currency) **and** the highest
  posting `sequence` summed (`throughSeq` per ADR-0006). Single query —
  single round-trip; consumed by `CloseAccountUseCase` (destructures
  `.balance`) and `ConsolidateAccountBalanceUseCase` (uses both). Impl
  `LedgerBalanceReaderTypeOrm` reads the ledger `postings` table read-only
  (`COALESCE(SUM(amountCents), 0)`). Wired by importing
  `PostingTypeOrmEntity` into the accounts `TypeOrmModule.forFeature` —
  **single** accounts→ledger infra touch (ADR-0009 distribution seam).
- **`AppendBalanceSnapshotRepository`** + **`GetLatestBalanceSnapshotRepository`** ports (FEAT-006) — segregated insert + read-latest. The trail is **append-only** by design; idempotency lives in the `ConsolidateAccountBalance` service (no DB unique constraint, so a retry races a no-op rather than a 500). `findLatestByAccountId` orders by `throughSeq DESC` (monotonic over the trail; `createdAt` would be the wrong tiebreak — wall-clock drift could lie about order).
- **Persistence:** `AccountTypeOrmEntity` (table `accounts`) + `BalanceSnapshotTypeOrmEntity` (table `balance_snapshots`, **append-only** — no `updatedAt`, no `deletedAt`, no `version`; index on `(accountId, throughSeq)`) + bidirectional mappers. Stack per ADR-0001 (TypeORM + better-sqlite3 `:memory:`).
- **Events:** emits `AccountOpenedEvent` via the `EventBus` port (impl
  `InMemoryEventBus` in `src/shared/infrastructure`). **Subscribes** to `ledger`'s
  `TransactionPosted` (FEAT-003) through `OnTransactionPostedHandler`, registered in
  `accounts.module.ts` `onModuleInit`.
- **HTTP:** `AccountController` (injects use cases via `@Inject(<TOKEN>)`) +
  `OpenAccountRequest` DTO (no class-validator; domain is the validation authority).

## 7. Open items

- Holds lifecycle (REQ-004/005) — deferred to a later accounts-deepening epic;
  `holdAmount` exists but no place/release endpoints.
- ✅ Event-driven `availableBalance` cache overwrite + `lastPostedSeq` checkpoint advance on `TransactionPosted` (FEAT-003, ADR-0006/0008) — done.
- ✅ `BalanceSnapshot` VO **type** landed (FEAT-003); **persistence + `ConsolidateAccountBalance` domain service live** (FEAT-006, ADR-0006). `POST /accounts/:id/consolidations` recomputes from the ledger via the widened `LedgerBalanceReader` ACL and appends a snapshot — idempotent (no-op when `throughSeq` doesn't advance; gate 2026-05-29). `throughSeq` = the global posting `sequence`. **Cache stays the responsibility of `OnTransactionPostedHandler`** — consolidate writes only the snapshot. Cold/archive tiering forward-looking.
- ✅ Status lifecycle — `freeze`/`activate`/`close` behaviors + `CloseAccountService` (close-by-ledger-recompute via the `LedgerBalanceReader` ACL); `frozen`/`closed` reject postings via the status-aware `AccountLookup` on the ledger side. **Live (FEAT-007, ADR-0010, SRS REQ-012/013).**
- Boundary DTO validation via `class-validator` — deferred (not a dependency yet);
  noted in `src/accounts/AGENTS.md`.
