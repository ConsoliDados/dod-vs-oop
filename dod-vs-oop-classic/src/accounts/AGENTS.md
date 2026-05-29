# AGENTS.md — `src/accounts/`

Read this before editing the accounts context. Refines the root `AGENTS.md` and the playbook; does not override the throw-based mantras.

## Responsibility

Owns the **account lifecycle**: opening an account and reading it and its available balance (REQ-001/002/003). Holds `AccountAggregate` (id, ownerId, currency, status, availableBalance, holdAmount, version). Consumes the shared `Identifier` / `Money` VOs and the in-memory EventBus from `src/shared/`. **Does not own** postings, transactions, or balance mutation — those belong to the `ledger` context (FEAT-002+); this context will only *react* to ledger events later (FEAT-003).

## Boundaries

- **Depends on:** `src/core/` (Entity/AggregateRoot/Validator/errors/use-case bases), `src/shared/` (`Identifier`, `Money`, `InMemoryEventBus`).
- **Consumed by:** `src/app.module.ts` (composition root). No other bounded context imports this one's `domain/` or `application/`.
- **Cross-context comms:** emits `AccountOpenedEvent` on the synchronous in-memory EventBus (no Outbox — playbook §7, ADR-0003). No consumers yet.

## Layout

```
src/accounts/
├── domain/
│   ├── account-status.ts       — 'active' | 'frozen' | 'closed' (+ ACCOUNT_STATUSES)
│   ├── entities/account.aggregate.ts   — AccountAggregate (create / buildExisting, throws on invalid; freeze/activate/close transition guards)
│   ├── validators/account.validator.ts — one validateX() per field; throws InvalidEntityError
│   ├── services/close-account.service.ts — CloseAccountService (FEAT-007; pure, no I/O — receives the ledger-recomputed balance)
│   └── events/account-opened.event.ts  — AccountOpenedEvent (BaseDomainEvent)
├── application/                 — FRAMEWORK-FREE (no NestJS imports)
│   ├── usecases/                — OpenAccount / GetAccount / GetBalance / FreezeAccount / ActivateAccount / CloseAccount (plain classes; ctor takes ports)
│   ├── repositories/            — segregated PORTS: CreateAccountRepository, GetAccountRepository, UpdateAccountRepository (no DI token)
│   ├── ports/                   — LedgerBalanceReader (FEAT-007; accounts→ledger ACL)
│   ├── mappers/                 — AccountUseCaseMapper (domain → AccountDto)
│   ├── handlers/                — OnTransactionPostedHandler (FEAT-003; swallow-and-log on cache failure)
│   └── errors/                  — AccountNotFoundError (UseCaseError, → 404); OptimisticLockError (DomainError, caught by handler); AccountNotClosableError (UseCaseError, → 422)
└── infrastructure/              — WHERE NESTJS LIVES
    ├── accounts.module.ts       — NestJS module; composes the providers below; imports PostingTypeOrmEntity (read-only) for the LedgerBalanceReader ACL
    ├── acl/                     — LedgerBalanceReaderTypeOrm (reads ledger postings read-only)
    ├── provider/
    │   ├── usecases/            — Symbol token + useFactory(...) per use case
    │   ├── repositories/        — Symbol token + useClass per repository port
    │   ├── handlers/            — Symbol token + factory for the cross-context handler
    │   └── acl/                 — Symbol token + useClass for the LedgerBalanceReader ACL
    ├── typeorm/                 — AccountTypeOrmEntity + bidirectional mapper + per-op repositories
    └── http/                    — AccountController (injects use cases via @Inject token) + request DTO
```

## Commands

```bash
pnpm test                       # vitest run (unit co-located + tests/accounts e2e)
pnpm lint                       # biome check src tests
pnpm typecheck                  # tsc --noEmit
```

## Conventions specific to this module

- **Application is framework-free (ADR-0005)**: use cases are plain classes whose constructor takes ports (repository interfaces + the `EventBus` port). No `@Injectable` / `@Inject` in `application/`. DI tokens + providers live in `infrastructure/provider/{usecases,repositories}/` (Symbol next to its provider); the controller injects use cases via `@Inject(<TOKEN>)`. Don't reintroduce NestJS into `domain/` or `application/`.
- **Money is integer minor units** (cents) end-to-end (ADR-0004): the aggregate holds `Money`, the DTO/balance expose `getCents()` as `number`, persistence is `bigint` cents. Never reintroduce float amounts.
- **HTTP input is not class-validator-decorated**: the domain (`AccountAggregate` / `Money`) is the validation authority and throws → 422 via the shared `DomainExceptionFilter`. If boundary DTO validation is wanted, add `class-validator` first.
- **`buildExisting` re-validates** trusted DB rows (cheap guard against corrupt persistence); the mapper coerces sqlite `datetime` back to `Date`.

## Points of attention

- The aggregate's `validator` runs **inside the constructor**, so an invalid account can never exist — tests assert the throw, they cannot construct an invalid instance to inspect.
- `OpenAccountUseCase` pulls events from the **in-memory aggregate** built by `create`, not from the repo's rehydrated return value (which carries none). Don't "simplify" this to `persisted.pullDomainEvents()`.
- Public surface is the exports reachable from `accounts.module.ts` + the controller routes — adding a use case or endpoint is a surface change; update this file and `sdd-accounts.md`.

## References

- [[docs/dod-vs-oop-classic/architecture/adrs/0002-throw-on-first-violation.md]] — error strategy this context follows
- [[docs/dod-vs-oop-classic/architecture/adrs/0004-money-integer-minor-units.md]] — Money representation
- [[docs/dod-vs-oop-classic/architecture/sdds/sdd-accounts.md]] — tactical design of this context
