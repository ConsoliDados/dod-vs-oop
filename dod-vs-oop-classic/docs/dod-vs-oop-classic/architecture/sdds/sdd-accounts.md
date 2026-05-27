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
| `FreezeAccountUseCase` *(FEAT-007)* | `{ id }` | `AccountDto` (200) | `AccountNotFoundError` → 404; `InvalidEntityError` (illegal transition) → 422 |
| `ActivateAccountUseCase` *(FEAT-007)* | `{ id }` | `AccountDto` (200) | `AccountNotFoundError` → 404; `InvalidEntityError` → 422 |
| `CloseAccountUseCase` *(FEAT-007)* | `{ id }` | `AccountDto` (200) | `AccountNotFoundError` → 404; `AccountNotClosableError` (non-zero ledger balance) → 422; `InvalidEntityError` → 422 |

HTTP surface (`AccountController`): `POST /accounts`, `GET /accounts/:id`,
`GET /accounts/:id/balance`, and *(FEAT-007)* `PATCH /accounts/:id/freeze`,
`PATCH /accounts/:id/activate`, `POST /accounts/:id/closure`.

**Event subscriber (FEAT-003):** `OnTransactionPostedHandler` reacts to `ledger`'s
`TransactionPosted` on the synchronous in-memory bus — per affected account it folds
the net signed delta into `availableBalance` and advances `lastPostedSeq` via
`reflectPosting`, persisting through `UpdateAccountRepository`. Framework-free
(ADR-0005); registered with the bus in `accounts.module.ts` `onModuleInit`. Reads
the inbound payload as a locally-declared contract, never importing `ledger/domain`.

**Domain service (FEAT-007, ADR-0010):** status transitions (`freeze`/`activate`/
`close`) are intention-revealing behaviors on the aggregate, each under a transition
guard. Closing is gated by `CloseAccountService` — it requires a **zero balance
recomputed from the ledger** (NFR-DATA-001), read via the `LedgerBalanceReader` ACL
(accounts→ledger). The *decision* spans contexts (service); the *transition* is
`account.close()` on the aggregate.

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
- **`LedgerBalanceReader` port** (`application/ports/`, *FEAT-007*) — cross-context read
  (accounts→ledger ACL): the account's balance summed from the ledger posting history
  (`Money`), used by `CloseAccountService` to verify a zero balance before close. Impl
  `LedgerBalanceReaderTypeOrm` reads the ledger `postings` table read-only.
- **Persistence:** `AccountTypeOrmEntity` (table `accounts`) + bidirectional
  `AccountTypeOrmMapper` (`toPersistence` / `toDomain`). Stack per ADR-0001
  (TypeORM + better-sqlite3 `:memory:`).
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
- ✅ `BalanceSnapshot` VO **type** landed (FEAT-003). Its append-only persistence + the `ConsolidateAccountBalance` domain service remain FEAT-006 (ADR-0006); `throughSeq` = the global posting `sequence`. Cold/archive tiering forward-looking.
- 🔜 Status lifecycle — `freeze`/`activate`/`close` behaviors + `CloseAccountService` (close-by-ledger-recompute via the `LedgerBalanceReader` ACL); `frozen`/`closed` reject postings. **Designed (FEAT-007, ADR-0010, SRS REQ-012/013), pending implementation**; pulled ahead of FEAT-004/005.
- Boundary DTO validation via `class-validator` — deferred (not a dependency yet);
  noted in `src/accounts/AGENTS.md`.
