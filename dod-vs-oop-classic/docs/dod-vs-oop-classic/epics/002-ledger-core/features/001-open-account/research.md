# FEAT-001 open-account — Research

RPA stage 1. Prior art, options considered, decisions made. Feeds `plan.md`.

## Sources / prior art

- **`src/core/`** (this project) — `Entity`, `AggregateRoot`, `ValueObject`, `Validator`/`EntityValidator` are already throw-based (ADR-0002). `AccountAggregate` extends `AggregateRoot<AccountValidator, InvalidEntityError>`.
- **`src/shared/value-objects/`** — `Identifier` (UUID) and `Money` (currency-aware, integer cents) already exist and are throw-based. Reuse both; do **not** define local id/money types (playbook anti-pattern).
- **`a real-world production ledger system`** — production reference for the verbose AggregateRoot shape: ~300-line aggregate, 12+-arg `buildExisting`, 20+ getters, per-field validator methods, segregated repos, bidirectional TypeORM mappers, DTOs as nested namespaces. This feature mirrors that shape at minimal size.
- **`playbook.md`** §1-10 — the mantras this code must follow (throw, factories, private fields + getters, validator per entity, segregated repos, mappers, DTOs as namespaces, soft delete).
- **SRS** REQ-001/002/003 + glossary (Account, Available balance); **SAD** §3 (accounts context owns `AccountAggregate`), §5.4 (persistence), §5.5 (events).

## Decisions

1. **`AccountAggregate` fields**: `id: Identifier`, `ownerId: string`, `currency: Currency`, `status: AccountStatus`, `availableBalance: Money`, `holdAmount: Money`, `version: number`, plus base `createdAt/updatedAt/deletedAt`. `availableBalance`/`holdAmount` start at `Money.zero(currency)`.
2. **`AccountStatus`**: a string-union enum `'active' | 'frozen' | 'closed'` for now (open → `active`). Lifecycle transitions (freeze/close) are out of scope here; keep the field but only `active` is produced.
3. **`create(ownerId, currency)`** assigns a fresh `Identifier.create()`, zeroed balances, `active`, `version = 0`, timestamps now; validator runs in constructor and throws on invalid (e.g. empty ownerId, unsupported currency — though `Money.zero` already guards currency).
4. **`buildExisting(props)`** reconstructs from DB rows. **Reconstruction policy**: re-run the validator (cheap, and guards against corrupt rows) but expect it to pass for valid persisted data. Documented to avoid the "validator throws on hydration" risk flagged in the epic.
5. **Repositories segregated per operation** (playbook §5): `CreateAccountRepository` (`insert`), `GetAccountRepository` (`findById`). No generic `Repository<T>`. Each with `namespace { Input; Output }`.
6. **TypeORM persistence**: `AccountTypeOrmEntity` is a flat POJO entity (columns: id, ownerId, currency, availableBalanceCents `bigint`, holdAmountCents `bigint`, status, version, createdAt, updatedAt, deletedAt). `AccountTypeOrmMapper.toPersistence/toDomain` translate. **Money stored as integer cents** in a `bigint` column (avoids float; matches `Money` VO's minor-unit representation).
   - **Pre-task (ADR-0004)**: the scaffolded `Money` VO currently stores a **float** — refactor it to **integer minor units** before wiring the aggregate. New API: store integer cents internally; `fromCents(cents, currency)` primary ctor + `fromDecimal(value, currency)` boundary helper (half-even); `getCents()`, `format()`. Update `money.spec.ts` accordingly. This is the float-money fix required by SRS §6 + ADR-0004.
7. **Soft delete**: `deletedAt` column; `GetAccountRepository.findById` filters `WHERE deletedAt IS NULL` (REQ-002 "404 if soft-deleted").
8. **HTTP**: `AccountController` with `POST /accounts`, `GET /accounts/:id`, `GET /accounts/:id/balance`. DTOs as nested namespaces (`OpenAccount.Input/Output`). A NestJS exception filter (added here, reused across contexts) maps `DomainError` → 422 and a "not found" → 404 with the SRS error shape.
9. **No new ADR needed**: choices above are consistent with ADR-0001/0002/0003. Money-as-bigint is a detail recorded here, not an ADR (reversible, low blast radius).

## Tradeoffs considered

- **AccountStatus as VO vs string-union**: VO would be more "verbose-canonical", but with no transition logic in scope, a string-union is honest and avoids dead code. Revisit when freeze/close lands.
- **Re-validate on `buildExisting` vs trust DB**: chose re-validate (cheap, safer). The DOD side will likely trust the repo snapshot — a nice contrast point for `ARCHITECTURE.md` later.
- **Balance as `Money` VO field vs raw cents on the aggregate**: chose `Money` VO (richer, currency-safe, matches the verbose style). The arithmetic cost is part of what the study measures vs the DOD side.

## ADR candidates

- None. (Money-as-bigint persistence noted here; promote to ADR only if it causes cross-cutting change.)
