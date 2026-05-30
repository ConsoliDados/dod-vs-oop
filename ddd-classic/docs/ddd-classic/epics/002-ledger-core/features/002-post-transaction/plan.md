# FEAT-002 post-transaction — Plan

RPA stage 2. Concrete, file-by-file. Tasks flow into `act.md`.

## File inventory (all under `src/ledger/`)

### domain/
- `domain/posting-direction.ts` — `export type PostingDirection = 'debit' | 'credit'` (+ const list); helpers `toSignedCents(amountCents, direction)` / `directionOf(signedCents)`.
- `domain/entities/posting.entity.ts` — `Posting extends Entity<PostingValidator, InvalidEntityError>`. Fields: `accountId: Identifier`, `amount: Money` (signed), `postedAt: Date`, `sequence?: number` (assigned at persistence; `undefined` until saved). `getSignedCents()`, `getDirection()`, `getAccountId()`, `getAmount()`. `create(accountId, amount, postedAt)` / `buildExisting(props)`.
- `domain/validators/posting.validator.ts` — non-zero amount; valid accountId; amount currency present.
- `domain/entities/transaction.aggregate.ts` — `TransactionAggregate extends AggregateRoot<TransactionValidator, InvalidEntityError>`. Fields: `reference?: string`, `postings: Posting[]`, `metadata: Record<string,unknown>`, `postedAt: Date`. `create(input)` builds postings, validates (throws), emits `TransactionPostedEvent`; `buildExisting(props)`. Getters incl. `getPostings()`, `getCurrency()`, `getEntries()` (for the event payload).
- `domain/validators/transaction.validator.ts` — `validatePostingCount` (≥2), `validateBalanced` (Σ signed cents == 0), `validateSingleCurrency` (all postings same currency), `validatePostingsValid`. Throws `InvalidEntityError`.
- `domain/events/transaction-posted.event.ts` — `TransactionPostedEvent extends BaseDomainEvent`, `EVENT_TYPE = 'TransactionPosted'`, payload `{ transactionId, postedAt, entries: { accountId, amountCents, currency }[] }`.

### application/  (framework-free, ADR-0005)
- `application/ports/account-lookup.port.ts` — `interface AccountLookup { findById(id): Promise<AccountView | null> }`, `AccountView = { id, currency, status }`.
- `application/repositories/create-transaction.repository.ts` — segregated port: `insert(tx): Promise<TransactionAggregate>` (writes tx + postings atomically; returns rehydrated with sequences). namespace `{ Input; Output }`.
- `application/usecases/post-transaction.usecase.ts` — `PostTransactionUseCase` (ctor: `CreateTransactionRepository`, `AccountLookup`, `EventBus`). `execute(input)`: build `TransactionAggregate` (throws if intrinsically invalid) → for each distinct accountId: `AccountLookup.findById` (404 if missing) + currency match (422 `CurrencyMismatchError`) → `repo.insert` → publish pulled `TransactionPosted` → return DTO.
- `application/mappers/transaction.usecase.mapper.ts` — `toDto(tx): TransactionDto` (id, reference?, postings [{accountId, amountCents, direction, currency}], postedAt, createdAt).
- `application/errors/currency-mismatch.error.ts` — `CurrencyMismatchError extends UseCaseError` (code `CURRENCY_MISMATCH` → 422).
- (reuse `accounts`' `AccountNotFoundError`? No — ledger shouldn't import accounts/application. Define a ledger-local `TransactionAccountNotFoundError extends UseCaseError` code `ACCOUNT_NOT_FOUND` → 404, so the `*_NOT_FOUND` convention maps it.)

### infrastructure/  (NestJS here)
- `infrastructure/typeorm/entities/transaction.typeorm.entity.ts` — `@Entity('transactions')` + `posting.typeorm.entity.ts` `@Entity('postings')` (FK transactionId, signed `amountCents bigint`, `sequence` monotonic, `postedAt`). No update/delete usage.
- `infrastructure/typeorm/mappers/transaction.typeorm.mapper.ts` — `toPersistence` (tx + postings), `toDomain` (rehydrate incl. sequence).
- `infrastructure/typeorm/repositories/create-transaction.typeorm.repository.ts` — `@Injectable`, writes within a single transaction (`dataSource.transaction(...)` or repo cascade), assigns `sequence`.
- `infrastructure/acl/account-lookup.typeorm.ts` — implements `AccountLookup` by reading the `accounts` table read-only (ACL; projects to `AccountView`). Imports the accounts TypeORM entity only (infra-to-infra), never `accounts/domain`.
- `infrastructure/http/controllers/transaction.controller.ts` — `@Controller('transactions')`, `POST /` (201). Converts `{amount, direction}` → signed at the boundary.
- `infrastructure/http/dtos/post-transaction.dto.ts` — request shape (no class-validator; domain throws → 422).
- `infrastructure/provider/usecases/post-transaction.provider.ts` — Symbol + `useFactory`.
- `infrastructure/provider/repositories/create-transaction.provider.ts` — Symbol + `useClass`.
- `infrastructure/provider/acl/account-lookup.provider.ts` — Symbol + `useClass`.
- `infrastructure/ledger.module.ts` — `TypeOrmModule.forFeature([Transaction, Posting, AccountTypeOrmEntity (read)])`, controller, providers.

### wiring + tests
- `app.module.ts` — import `LedgerModule`.
- `src/ledger/AGENTS.md` — module template (public surface ≥ 5 items — expected here).
- `tests/ledger/post-transaction.e2e.spec.ts` — happy (201, balanced); unbalanced (422); currency mismatch (422); missing account (404); <2 postings (422); event fired (assert via a test subscriber or balance side-effect once FEAT-003 — here assert 201 + persisted).

## Decisions locked

- Signed `Money` on postings (credit +, debit −); Σ == 0 is "balanced". HTTP keeps `{amount, direction}`, converted at the boundary.
- `throughSeq` (ADR-0006) = global monotonic posting `sequence`, assigned at persistence.
- Cross-context account check via `AccountLookup` port (ACL in ledger infra reading the accounts table read-only). Ledger never imports `accounts/domain`.
- Atomic write of transaction + postings (one DB transaction). Postings immutable (REQ-011): no update/delete repo methods.

## Task order

1. domain (posting-direction, posting entity+validator, transaction aggregate+validator, event) + co-located specs → green
2. application (AccountLookup port, create-transaction repo port, post-transaction use case, mapper, errors)
3. infrastructure (typeorm entities+mappers+repo, account-lookup ACL, controller+dto, providers)
4. wiring (ledger.module, app.module) + `src/ledger/AGENTS.md`
5. integration test `tests/ledger/post-transaction.e2e.spec.ts` → green
6. draft `sdds/sdd-ledger.md` (promotion trigger: new context, 5+ public items)
7. `pnpm check` + `pnpm test` green → update `act.md` retro + epic progress log

## Risks revisited

- **Atomic tx+postings write** in TypeORM/better-sqlite3 — use `dataSource.transaction` to keep balanced postings all-or-nothing.
- **ACL infra coupling** — `account-lookup.typeorm` importing the accounts entity is the one place infra layers touch; documented as ACL, isolated to one file.
- **Sequence monotonicity** under the single-process sqlite — autoincrement column suffices; revisit if concurrency model changes.
- **Event payload is plain data** — assert no domain object leaks onto the bus.
