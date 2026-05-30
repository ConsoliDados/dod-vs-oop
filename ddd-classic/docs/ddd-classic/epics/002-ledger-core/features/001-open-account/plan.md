# FEAT-001 open-account — Plan

RPA stage 2. Concrete, file-by-file. Tasks flow into `act.md` as a checklist.

## File inventory (all under `src/accounts/`)

### domain/
- `domain/account-status.ts` — `export type AccountStatus = 'active' | 'frozen' | 'closed'`.
- `domain/entities/account.aggregate.ts` — `AccountAggregate extends AggregateRoot<AccountValidator, InvalidEntityError>`. Private fields, `static create(ownerId, currency)`, `static buildExisting(props)`, 7+ getters (`getOwnerId`, `getCurrency`, `getStatus`, `getAvailableBalance`, `getHoldAmount`, `getVersion`), `toString()`, `getValidator()`. Reuses `Identifier` + `Money` from `shared/`.
- `domain/validators/account.validator.ts` — `AccountValidator extends EntityValidator<AccountAggregate, InvalidEntityError>`. `validate()`: `validateId`, `validateOwnerId` (non-empty), `validateCurrency` (Money VO already guards), `validateBalancesNonNegativeOnOpen`; throws `InvalidEntityError` if `hasErrors()`.
- `domain/events/account-opened.event.ts` — `AccountOpenedEvent extends BaseDomainEvent` (emitted on create; not yet consumed, but establishes the pattern).

### application/
- `application/repositories/create-account.repository.ts` — `interface CreateAccountRepository { insert(input): Promise<output> }` + `namespace { Input = AccountAggregate; Output = AccountAggregate }`.
- `application/repositories/get-account.repository.ts` — `interface GetAccountRepository { findById(id): Promise<AccountAggregate | null> }` + namespace.
- `application/usecases/open-account.usecase.ts` — `OpenAccountUseCase` (class, constructor DI of `CreateAccountRepository`). `execute({ownerId, currency})`: `AccountAggregate.create(...)` (throws if invalid) → `repo.insert` → `mapper.toDto`.
- `application/usecases/get-account.usecase.ts` — `GetAccountUseCase` (DI `GetAccountRepository`). 404 → throw `AccountNotFoundError` (new `UseCaseError` subtype).
- `application/usecases/get-balance.usecase.ts` — `GetBalanceUseCase` → returns `{ availableBalance, currency }`.
- `application/mappers/account.usecase.mapper.ts` — static `toDto(aggregate)` → `AccountDto` (id, ownerId, currency, status, availableBalance (cents), holdAmount, version, createdAt).
- `application/errors/account-not-found.error.ts` — `AccountNotFoundError extends UseCaseError` (code `ACCOUNT_NOT_FOUND`).

### infrastructure/
- `infrastructure/typeorm/entities/account.typeorm.entity.ts` — `@Entity('accounts')` POJO: id (uuid pk), ownerId, currency, availableBalanceCents (`bigint`), holdAmountCents (`bigint`), status, version, createdAt, updatedAt, deletedAt (nullable).
- `infrastructure/typeorm/mappers/account.typeorm.mapper.ts` — static `toPersistence(aggregate)` / `toDomain(entity)` (uses `AccountAggregate.buildExisting`, `Money` reconstruction from cents).
- `infrastructure/typeorm/repositories/create-account.typeorm.repository.ts` — `@Injectable` implements `CreateAccountRepository`.
- `infrastructure/typeorm/repositories/get-account.typeorm.repository.ts` — `@Injectable` implements `GetAccountRepository`, filters `deletedAt IS NULL`.
- `infrastructure/http/dtos/open-account.dto.ts` — request/response DTO types (nested namespace) + class-validator decorators on the request.
- `infrastructure/http/controllers/account.controller.ts` — `@Controller('accounts')`: `POST /`, `GET /:id`, `GET /:id/balance`.

### module + cross-cutting
- `accounts.module.ts` — registers TypeORM entity, providers (use cases + repo bindings via DI tokens), controller.
- `src/shared/infrastructure/http/domain-exception.filter.ts` — NestJS `@Catch()` filter mapping `DomainError` → 422, `UseCaseError` (not-found) → 404, into the SRS error shape `{ code, message, fields? }`. Wired in `main.ts`.
- `app.module.ts` — import `AccountsModule` + `TypeOrmModule.forRoot({ type: 'better-sqlite3', database: ':memory:', synchronize: true, entities: [...] })`.

### tests
- `src/accounts/domain/entities/account.aggregate.spec.ts` — create() happy; create() throws on empty ownerId; buildExisting round-trips.
- `src/accounts/domain/validators/account.validator.spec.ts` — accumulates + throws `InvalidEntityError`; error carries offending fields.
- `tests/accounts/open-account.e2e.spec.ts` — NestJS in-process: POST /accounts (201, balance 0), GET /accounts/:id (200, 404), GET /accounts/:id/balance (200), invalid input (422 + error shape).

## Decisions locked in this plan

- **Money column** = `bigint` storing integer cents; mapper converts via `Money.create(cents, currency)` / `money.getAmount()` (already minor units).
- **sqlite `:memory:` for tests**: integration test builds a fresh `TestingModule` per file with `synchronize: true` (schema auto-created); acceptable isolation for the suite size.
- **DI tokens**: repository interfaces bound via string/symbol tokens in `AccountsModule` (NestJS provider pattern), since interfaces have no runtime identity.

## Task order

0. **Refactor `src/shared/value-objects/money.ts` to integer minor units** (ADR-0004): float → integer cents internally; `fromCents`/`fromDecimal` ctors, `getCents()`, half-even rounding on multiply/divide; update `money.spec.ts`. Run specs → green. (Underpins account balance.)
1. domain (status, aggregate, validator, event) + unit specs → green
2. application (repos interfaces, use cases, mapper, error)
3. infrastructure (typeorm entity, mapper, repos, dtos, controller) + exception filter
4. wiring (accounts.module, app.module, main.ts filter)
5. integration test → green
6. `src/accounts/AGENTS.md` (module template) once public surface ≥ 5 items
7. draft `sdds/sdd-accounts.md` (promotion trigger)
8. `pnpm check` + `pnpm test` green → update `act.md` retro + epic progress log

## Risks revisited

- `buildExisting` re-validation: confirmed cheap; keep.
- Exception filter is cross-cutting — lives in `shared/`, not `accounts/`, so ledger reuses it.
