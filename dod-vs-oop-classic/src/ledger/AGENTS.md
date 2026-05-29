# AGENTS.md — `src/ledger/`

Read this before editing the ledger context. Refines the root `AGENTS.md` and the playbook; does not override the throw-based mantras.

## Responsibility

Owns the **append-only source of truth**: balanced double-entry transactions and their immutable postings (REQ-006, REQ-011). Validates the double-entry invariants and emits `TransactionPosted`. **Does not own** account balance (that's `accounts`, which reacts to the event in FEAT-003), account lifecycle, statements, or reconciliation.

## Boundaries

- **Depends on:** `src/core/` (Entity/AggregateRoot/Validator/errors), `src/shared/` (`Identifier`, `Money`, `EventBus` port).
- **Consumed by:** `src/app.module.ts`. Emits `TransactionPosted` for `accounts` (FEAT-003) over the in-memory bus.
- **Cross-context comms:**
  - **Read** — needs an account's currency/existence to post: via the `AccountLookup` **port** (`application/ports/`), implemented as an **ACL** in `infrastructure/acl/` that reads the `accounts` table read-only. The ledger never imports `accounts/domain`.
  - **Write** — emits the `TransactionPosted` plain-data event on the synchronous in-memory bus (no Outbox — ADR-0003).

## Layout

```
src/ledger/
├── domain/
│   ├── posting-direction.ts          — debit|credit + signed/direction helpers (credit +, debit −)
│   ├── entities/transaction.aggregate.ts — TransactionAggregate (root; create/buildExisting/reverseOf, throws)
│   ├── entities/posting.entity.ts    — Posting (non-root entity inside the transaction; signed Money)
│   ├── validators/{transaction,posting}.validator.ts — ≥2 postings, balanced (Σ signed == 0), single currency
│   └── events/transaction-posted.event.ts — TransactionPostedEvent (plain-data entries)
├── application/                       — FRAMEWORK-FREE (no NestJS)
│   ├── usecases/post-transaction.usecase.ts — plain class; ctor takes ports
│   ├── usecases/reverse-transaction.usecase.ts — FEAT-004; load → active guard → reverseOf → insert → publish
│   ├── usecases/list-postings.usecase.ts — FEAT-005; validates limit/window/cursor, 404 via AccountLookup
│   ├── cursor.ts                     — FEAT-005 base64 codec + InvalidCursorError (→ 422)
│   ├── ports/account-lookup.port.ts   — cross-context read port (ACL target; carries status FEAT-007)
│   ├── repositories/create-transaction.repository.ts — segregated port (atomic write)
│   ├── repositories/get-transaction.repository.ts    — FEAT-004 segregated read port
│   ├── repositories/list-postings.repository.ts      — FEAT-005 segregated query port (cursor + window)
│   ├── mappers/transaction.usecase.mapper.ts         — DTO carries optional reversedTransactionId
│   ├── mappers/posting-list.mapper.ts                — PostingListItem projection (FEAT-005)
│   └── errors/                       — TransactionAccountNotFoundError (→ 404), AccountNotActiveError (→ 422), TransactionNotFoundError (→ 404), InvalidCursorError (→ 422)
└── infrastructure/                    — WHERE NESTJS LIVES
    ├── ledger.module.ts
    ├── provider/{usecases,repositories,acl}/*.provider.ts — Symbol token + binding each
    ├── typeorm/{entities,mappers,repositories}/...        — Transaction + Posting tables; atomic insert + by-id read
    ├── acl/account-lookup.typeorm.ts  — reads the accounts table read-only (the one cross-infra touch)
    └── http/{controllers,dtos}/...    — TransactionController (POST /transactions, POST /transactions/:id/reversals); AccountPostingsController (GET /accounts/:id/postings)
```

## Commands

```bash
pnpm test                       # vitest run (unit co-located + tests/ledger e2e)
pnpm lint                       # biome check src tests
pnpm typecheck                  # tsc --noEmit
```

## Conventions specific to this module

- **Signed-Money postings** (ADR-0006 / FEAT-002): a posting stores a signed `Money` — **credit = positive, debit = negative**. A transaction is balanced ⇔ `Σ(signed) == 0`. The HTTP layer keeps the SRS `{ amount, direction }` shape and converts at the boundary; `direction` is derived from the sign for output.
- **`Posting` is an entity inside `TransactionAggregate`**, not its own aggregate — the balance invariant spans all postings, so they're created/validated together. Per-account reads (balance, listing) use query repositories, not the write aggregate.
- **`sequence` is the global monotonic order** (`throughSeq`, ADR-0006), DB-generated at insert (the posting row's primary key); the domain id stays a uuid.
- **Account validation is the use case's job**, not the aggregate's: existence (→ 404) + the accounts sharing a currency (surfaces as the aggregate's single-currency invariant, since each posting's currency is its account's).
- Application is **framework-free** (ADR-0005): no `@Injectable`/`@Inject` in `domain/` or `application/`.

## Points of attention

- **Postings are immutable (REQ-011)** — there is no update/delete repository path. Corrections are reversals (FEAT-004, ADR-0011) — a *new* aggregate via `TransactionAggregate.reverseOf(original)` with a one-way `reversedTransactionId`; the original row is byte-identical before and after. No `reversedBy` denormalization on the original.
- **Atomic write**: the transaction row + its posting rows are saved in one DB transaction (`DataSource.transaction`) so a balanced set is all-or-nothing.
- The `AccountLookupTypeOrm` ACL is the **only** place ledger infra imports an `accounts` artifact (the persistence entity). Keep it there; never import `accounts/domain` or `accounts/application`.
- `PostTransactionUseCase` pulls events from the **in-memory aggregate**, not the repo's rehydrated return.

## References

- [[docs/dod-vs-oop-classic/architecture/adrs/0002-throw-on-first-violation.md]] — error strategy
- [[docs/dod-vs-oop-classic/architecture/adrs/0003-sync-in-memory-eventbus-no-outbox.md]] — TransactionPosted delivery
- [[docs/dod-vs-oop-classic/architecture/adrs/0006-balance-snapshot-and-consolidation.md]] — signed model + `throughSeq`
- [[docs/dod-vs-oop-classic/architecture/sdds/sdd-ledger.md]] — tactical design of this context
