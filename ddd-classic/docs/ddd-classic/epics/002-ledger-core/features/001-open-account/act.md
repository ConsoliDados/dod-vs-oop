# FEAT-001 open-account — Act

RPA stage 3. Live task tracker (pulled from `plan.md`) + execution log + retro. Tick as work happens.

## Tasks

### 0. Money refactor (ADR-0004)
- [x] `src/shared/value-objects/money.ts` → integer minor units (fromCents/fromDecimal, getCents, half-even); update `money.spec.ts` green

### 1. Domain
- [x] `domain/account-status.ts`
- [x] `domain/entities/account.aggregate.ts`
- [x] `domain/validators/account.validator.ts`
- [x] `domain/events/account-opened.event.ts`
- [x] `account.aggregate.spec.ts` + `account.validator.spec.ts` green

### 2. Application
- [x] `application/repositories/create-account.repository.ts`
- [x] `application/repositories/get-account.repository.ts`
- [x] `application/usecases/open-account.usecase.ts`
- [x] `application/usecases/get-account.usecase.ts`
- [x] `application/usecases/get-balance.usecase.ts`
- [x] `application/mappers/account.usecase.mapper.ts`
- [x] `application/errors/account-not-found.error.ts`

### 3. Infrastructure
- [x] `infrastructure/typeorm/entities/account.typeorm.entity.ts`
- [x] `infrastructure/typeorm/mappers/account.typeorm.mapper.ts`
- [x] `infrastructure/typeorm/repositories/create-account.typeorm.repository.ts`
- [x] `infrastructure/typeorm/repositories/get-account.typeorm.repository.ts`
- [x] `infrastructure/http/dtos/open-account.dto.ts`
- [x] `infrastructure/http/controllers/account.controller.ts`
- [x] `shared/infrastructure/http/domain-exception.filter.ts`

### 4. Wiring
- [x] `accounts.module.ts`
- [x] `app.module.ts` (import AccountsModule + TypeOrmModule.forRoot sqlite memory)
- [x] `main.ts` — filter wired via `APP_FILTER` provider in `AppModule` instead (applies in e2e too); `main.ts` left as the plain bootstrap. Added `src/shared/shared.module.ts` (@Global) to share the EventBus singleton across contexts.

### 5. Integration + close
- [x] `tests/accounts/open-account.e2e.spec.ts` green (6 e2e cases)
- [x] `src/accounts/AGENTS.md` (module template) when public surface ≥ 5 items
- [x] draft `sdds/sdd-accounts.md`
- [x] `pnpm check` + `pnpm test` green
- [x] update epic `002-ledger-core/README.md` progress log

## Execution log

<!-- Append dated notes as work happens: surprises, deviations from plan, decisions. -->

- 2026-05-21 — **Task 0 (Money, ADR-0004)** done. Refactored `money.ts` from float to integer minor units. Internal value is now `{ cents, currency }`. Primary ctor `fromCents`; boundary helper `fromDecimal` (half-even); framework-mandated `create`/`buildExisting` delegate to `fromCents` (kept because the `ValueObject` base + playbook §2 require both on every VO). Replaced `getAmount()` with `getCents()`. Module-level `roundHalfEven` powers multiply/divide/fromDecimal. `money.spec.ts` rewritten (15 tests, green). **No Decimal lib added** (ADR-0004 policy). Note: `plan.md` line 42 referenced `Money.create(cents)` + `getAmount()`; reconciled to the session-authoritative API (`fromCents`/`getCents`) — `create` retained as an alias so existing framework contracts hold.

- 2026-05-21 — **Domain** done. `AccountAggregate` (create/buildExisting, validator runs in ctor → throws), `AccountValidator` (one `validateX` per field, accumulate-then-throw `InvalidEntityError.forAggregate`), `AccountStatus` union, `AccountOpenedEvent`. Co-located specs green (8 tests). `create` emits the event after construction; `buildExisting` re-validates and emits nothing.
- 2026-05-21 — **Application** done. Segregated repo ports (`Create`/`Get`) with Symbol DI tokens (interfaces have no runtime identity); `Open`/`Get`/`GetBalance` use case classes (constructor DI); `AccountUseCaseMapper` (domain → `AccountDto`, money as cents); `AccountNotFoundError` (`UseCaseError`, `ACCOUNT_NOT_FOUND`). `OpenAccountUseCase` pulls events from the in-memory aggregate (not the repo's rehydrated return, which carries none) — commented in code.
- 2026-05-21 — **Infrastructure** done. `AccountTypeOrmEntity` (money as `bigint` cents, soft-delete `deletedAt`), bidirectional `AccountTypeOrmMapper` (coerces sqlite `datetime` → `Date` defensively, else the throw-based validator would reject string dates), per-op TypeORM repos (`Get` filters `deletedAt IS NULL`), `AccountController` (POST/GET/GET balance), `OpenAccountRequest` DTO. **Deviation from research/plan**: no `class-validator` on the request DTO — it's not a dependency, and the domain (`AccountAggregate`/`Money`) already throws → 422 via the filter (faithful to throw-based design). Logged in `sdd-accounts.md` §7 + module AGENTS.md; easy to add later.
- 2026-05-21 — **Wiring** done. `DomainExceptionFilter` (shared) maps `DomainError`→422 (`{code,message,fields[]}`), `*_NOT_FOUND` `UseCaseError`→404, else 500. Wired via `APP_FILTER` provider in `AppModule` (applies in e2e too) instead of `main.ts useGlobalFilters`. Added `@Global` `SharedModule` providing the `InMemoryEventBus` singleton. `AppModule` gets `TypeOrmModule.forRoot` (better-sqlite3 `:memory:`, `synchronize`, `autoLoadEntities`). Kept `AppController`/`AppService` so the existing smoke e2e still passes.
- 2026-05-21 — **Integration + gates** done. `tests/accounts/open-account.e2e.spec.ts` (6 cases: 201 open, 200 read, 404 unknown, 200 balance, 422 missing-ownerId with `fields`, 422 bad-currency). Full suite 35/35; `pnpm check` (biome + typecheck) clean.
- 2026-05-21 — **Bootstrap gaps fixed mid-flight** (surfaced by the e2e boot):
  1. `better-sqlite3` native addon was never compiled (pnpm 10 blocks build scripts unless allowlisted) → e2e + the pre-existing smoke test hung on TypeORM connect-retry. Added `pnpm.onlyBuiltDependencies: ["better-sqlite3"]` to `package.json` and rebuilt the addon.
  2. Biome could not parse NestJS parameter decorators (`@Inject`/`@Body`/`@Param`) → added `javascript.parser.unsafeParameterDecoratorsEnabled: true` to `biome.json`.

- 2026-05-22 — **Post-FEAT-001 refactor: framework-agnostic application (ADR-0005).** Decoupled use cases from NestJS — they are now plain classes taking ports via constructor (no `@Injectable`/`@Inject`). Introduced the `EventBus` port (`src/shared/application/event-bus.ts`); `InMemoryEventBus` implements it. Moved DI tokens + providers into `src/accounts/infrastructure/provider/{usecases,repositories}/` (Symbol next to its `useFactory`/`useClass` provider) and the NestJS module into `src/accounts/infrastructure/accounts.module.ts`. Controller injects use cases via `@Inject(<TOKEN>)`. Motivation: the planned Bun+Elysia re-host of this same design (honest benchmarks) + SAD §4 (application must not import infrastructure). Wrote ADR-0005; updated playbook (structure + §10), root + module `AGENTS.md`, `sdd-accounts.md`. Gates still green (typecheck + biome + 35 tests).

## Retro

- **Shipped**: full `accounts` vertical slice (REQ-001/002/003) in the verbose-canonical throw-based style, all gates green. The pattern stack (AggregateRoot+Validator throw, segregated repos, bidirectional mapper, DTO-namespaces, soft delete, sync EventBus) is now established for FEAT-002 to mirror in `ledger`.
- **Punted (intentional)**: holds lifecycle (REQ-004/005), event-driven balance (FEAT-003), `class-validator` boundary DTOs, `sdd-ledger.md`.
- **Surprises**: (1) the real blocker wasn't domain code but two latent bootstrap gaps (native addon build + Biome decorator parser) — worth folding back into EPIC-001's checklist so the next clone is clean. (2) `plan.md` referenced `Money.create`/`getAmount`; reconciled to the session-authoritative `fromCents`/`getCents` while keeping `create`/`buildExisting` for the framework + playbook §2 mandate.
- **Pending**: human review at gate §16.3, then branch + commit + PR (git not yet initialized — left to the human per session instruction).
