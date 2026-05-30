# Playbook — `ddd-classic`

> **OOP foil** of the comparative study. This playbook governs **only this project** — deliberately different from the playbook in `~/Dev/project_templates/`, which is lean / DOD-friendly. Here the style is **verbose-canonical DDD** (Evans/Vernon), mirroring the real production implementation (`a real-world production ledger system`). It's an **honest foil, not a strawman**.

## Mantras (non-negotiable)

1. **Throw on first violation.** Validators accumulate errors but the Entity/VO constructor **throws** `InvalidEntityError` / `InvalidValueObjectError` / `InvalidIdentifierError` on the first invalid instantiation. **Do NOT use `Result<T, E>`** — that's the point of the comparison against the DOD side.
2. **Mandatory static factory methods** on every Entity and VO: `create(...args)` and `buildExisting(props)`. The base Entity asserts this at runtime.
3. **`private` fields, access via getters.** No public properties. A typical Aggregate has 20+ getters.
4. **Dedicated Validator per Entity.** `XValidator extends EntityValidator<X, InvalidEntityError>` with one `validateY()` method per field.
5. **Repository segregated per operation** (CQRS-style): `CreateAccountRepository`, `UpdateAccountRepository`, `GetAccountRepository`, `ListAccountsRepository`, `SoftDeleteAccountRepository` — each its own interface with `namespace { type Input; type Output }`.
6. **Bidirectional static Mappers** between domain and TypeORM: `XTypeOrmMapper.toPersistence(domain) → entity` and `.toDomain(entity) → aggregate`.
7. **Synchronous in-memory EventBus.** No Outbox. `Promise.all` on subscribers.
8. **DTOs as nested namespaces**: `namespace CreateAccount { type Input; type Output }`. Type-safe, verbose, faithful.
9. **Mandatory soft delete**: every Entity carries `deletedAt?: Date` in the base; queries filter `WHERE deletedAt IS NULL`.
10. **UseCase classes are framework-agnostic**: plain classes (no `@Injectable` / `@Inject`), constructor takes **ports** (repository interfaces + the `EventBus` port) as args, `execute()` orchestrates (repo + mapper + domain + bus). The NestJS wiring — DI tokens + providers — lives in `infrastructure/provider/{usecases,repositories}/`, and the framework module (`<context>.module.ts`) lives in `infrastructure/`. `domain/` + `application/` stay free of any framework so the infra layer (NestJS today, Elysia/Bun later) is swappable. See ADR-0005.

## Per-bounded-context structure

Each bounded context is a vertical slice with the **framework fully encapsulated in `infrastructure/`** (ADR-0005). `domain/` and `application/` are plain TypeScript — no NestJS imports. The NestJS module and all DI wiring live under `infrastructure/`.

```
src/<context>/
├── domain/
│   ├── entities/
│   │   ├── x.aggregate.ts           # AggregateRoot (typical 300+ lines)
│   │   └── y.entity.ts              # non-root Entity
│   ├── validators/
│   │   ├── x.validator.ts           # EntityValidator with one method per field
│   │   └── y.validator.ts
│   └── events/
│       └── x-happened.event.ts      # extends BaseDomainEvent
├── application/                     # FRAMEWORK-FREE
│   ├── usecases/
│   │   ├── create-x.usecase.ts      # plain class; ctor takes ports; no @Injectable
│   │   └── ...
│   ├── repositories/                # segregated PORTS (interface + namespace { Input; Output }); NO DI token
│   │   ├── create-x.repository.ts
│   │   ├── get-x.repository.ts
│   │   └── ...
│   └── mappers/
│       └── x.usecase.mapper.ts      # toDto, toDtoList (Domain → DTO)
└── infrastructure/                  # WHERE NESTJS LIVES (swap this for Elysia/Bun)
    ├── <context>.module.ts          # @Module — composes the providers below
    ├── provider/
    │   ├── usecases/
    │   │   └── create-x.provider.ts # Symbol token + { provide, inject, useFactory: () => new CreateXUseCase(...) }
    │   └── repositories/
    │       └── create-x.provider.ts # Symbol token + { provide, useClass: CreateXTypeOrmRepository }
    ├── typeorm/
    │   ├── entities/
    │   │   └── x.typeorm.entity.ts  # @Entity TypeORM
    │   ├── mappers/
    │   │   └── x.typeorm.mapper.ts  # toPersistence + toDomain
    │   └── repositories/
    │       ├── create-x.typeorm.repository.ts   # @Injectable; implements the port
    │       └── ...
    └── http/
        ├── controllers/
        │   └── x.controller.ts      # @Controller; injects use cases via @Inject(<TOKEN>)
        └── dtos/
            └── create-x.dto.ts
```

DI tokens are `Symbol`s declared **next to their provider** in `infrastructure/provider/`. Use cases receive ports through a `useFactory`; repository ports bind to TypeORM impls through `useClass`. The cross-context `EventBus` port lives in `src/shared/application/`, its impl + token in `src/shared/infrastructure/`.

## Naming conventions

| Kind | Convention | Example |
|---|---|---|
| Class | PascalCase | `AccountAggregate`, `AccountValidator` |
| File | kebab-case + `.kind.ts` suffix | `account.aggregate.ts`, `account.validator.ts`, `account.usecase.ts`, `account.typeorm.mapper.ts` |
| Creation method | `static create(...)` | positional args |
| Reconstruction method | `static buildExisting(props)` | object of props (coming from DB) |
| Getter | `get<Field>()` | `getAccountId()`, `getBalance()` |
| Setter | DO NOT use | mutate via controlled `update(input: Partial)` |
| Internal validation | `validate<Field>()` | one per field |
| Event | `<Aggregate><PastTense>Event` | `TransactionPostedEvent`, `AccountFrozenEvent` |
| Repo interface | `<Verb><Entity>Repository` | `CreateAccountRepository` |

## HTTP / API conventions

**Not strict REST.** Resource URLs look REST-ish, but **aggregate behaviors are first-class, named endpoints** (DDD commands as routes), never forced into generic CRUD verbs.

- **Resources / collections:**
  - `GET /things` — list (paginated, filterable).
  - `POST /things` — create.
  - `GET /things/:id` — read one.
- **Behaviors / state transitions** — the command name is in the **path**, the payload is **minimal** (only the command's inputs, not the whole resource):
  - `PATCH /things/:id/<command>` (or `PUT`) — state transition: `/confirm`, `/cancel`, `/reschedule`, `/freeze`, `/close`.
  - `POST /things/:id/<sub>` — create a sub-entity produced by a command: `/holds`, `/reversals`, `/statements`.
  - `DELETE /things/:id/<sub>/:subId` — undo a sub-entity (e.g. release a hold).
- Each behavior endpoint maps **1:1 to an aggregate method / use case**.
- **Rationale:** pure REST forces rich domain behavior into awkward "PUT the whole resource" shapes; exposing the verb makes the API self-describing and aligns the transport with the domain's ubiquitous language.

This study's surface already follows it: `POST /transactions` (create), `POST /transactions/:id/reversals` (reverse), `POST /accounts/:id/holds` + `DELETE /accounts/:id/holds/:holdId` (place/release), `POST /accounts/:id/statements`.

## Pattern: Aggregate Root

```ts
// account.aggregate.ts (~300 lines in real-world cases)
export class AccountAggregate extends AggregateRoot<AccountValidator, InvalidEntityError> {
  protected validator!: AccountValidator

  private constructor(
    id: Identifier,
    private readonly ownerId: string,
    private balance: Money,
    private holdAmount: Money,
    private status: AccountStatus,
    private currency: Currency,
    private version: number,
    createdAt: Date,
    updatedAt: Date,
    deletedAt?: Date,
  ) {
    super(id, createdAt, updatedAt, deletedAt)
    this.validator = new AccountValidator(this)
    this.validator.validate() // throws InvalidEntityError if invalid
  }

  static create(ownerId: string, currency: Currency): AccountAggregate {
    const now = new Date()
    return new AccountAggregate(
      Identifier.create(),
      ownerId,
      Money.zero(currency),
      Money.zero(currency),
      AccountStatus.ACTIVE,
      currency,
      0,
      now,
      now,
    )
  }

  static buildExisting(props: { /* 10+ fields */ }): AccountAggregate {
    return new AccountAggregate(/* 12+ positional args */)
  }

  // 20+ getters
  public getOwnerId(): string { return this.ownerId }
  public getBalance(): Money { return this.balance }
  // ...

  // Controlled mutations
  public placeHold(amount: Money): void {
    if (this.balance.subtract(this.holdAmount).isLessThan(amount)) {
      throw new InsufficientFundsError(...)
    }
    this.holdAmount = this.holdAmount.add(amount)
    this.version += 1
    this.updateUpdatedAt()
    this.addDomainEvent(new HoldPlacedEvent(this.getId().getValue(), amount))
  }

  public toString(): string { return `AccountAggregate(${this.getId().getValue()})` }
  public getValidator(): AccountValidator { return this.validator }
}
```

## Pattern: Segregated Repository

```ts
// application/repositories/create-account.repository.ts
export interface CreateAccountRepository {
  insert(input: CreateAccountRepository.Input): Promise<CreateAccountRepository.Output>
}
export namespace CreateAccountRepository {
  export type Input = AccountAggregate
  export type Output = AccountAggregate
}
```

```ts
// infrastructure/typeorm/repositories/create-account.typeorm.repository.ts
@Injectable()
export class CreateAccountTypeOrmRepository implements CreateAccountRepository {
  constructor(@InjectRepository(AccountTypeOrmEntity) private repo: Repository<AccountTypeOrmEntity>) {}
  async insert(account: AccountAggregate): Promise<AccountAggregate> {
    const entity = AccountTypeOrmMapper.toPersistence(account)
    const saved = await this.repo.save(entity)
    return AccountTypeOrmMapper.toDomain(saved)
  }
}
```

## Anti-patterns (DO NOT use here)

- ❌ `Result<T, E>` — that's the DOD side.
- ❌ Free functions for use cases — use classes.
- ❌ Generic `Repository<T>` — use one interface per operation.
- ❌ Transactional Outbox — use the synchronous in-memory EventBus.
- ❌ `match(...)` helper — use `try/catch` or let `throw` propagate.
- ❌ Plain types for entities — use a class with getters.
- ❌ `(NewState, Events[])` return — use internal `this.addDomainEvent()`.
- ❌ Immutable spread on state — use controlled mutation via methods.

## Tests

- **Unit tests co-located** with the source (`money.ts` + `money.spec.ts` in the same directory). **No `__tests__/` subdir.**
- **Integration / E2E tests** in `tests/` at the `src/` level (e.g. `tests/ledger/post-transaction.e2e.spec.ts`, `tests/app.e2e.spec.ts`).
- Vitest with `globals: true` (no explicit `import { describe, it, expect }` required, but allowed for clarity).
- Asserting `expect(() => x).toThrow(InvalidEntityError)` is the standard pattern.
- For the Notification Pattern accumulated inside validators (before they throw): `expect(err.errors.length).toBeGreaterThanOrEqual(N)`.

## When to update this playbook

Whenever you (or an agent) have a doubt about "how to do X here", add the answer as a rule. This file is the local source of truth — it overrides the general playbook in `~/Dev/project_templates/`, which follows the lean / DOD style.
