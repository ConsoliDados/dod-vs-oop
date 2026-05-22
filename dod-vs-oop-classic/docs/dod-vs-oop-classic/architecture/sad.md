# Dod Vs Oop Classic — Software Architecture Description (SAD)

Strategic-level architecture. The "what fits where" view. Tactical detail per area lives in `sdds/sdd-<area>.md`.

> **Implementation-specific.** This SAD describes the *how* for the **verbose-canonical OOP** implementation of the shared [`srs.md`](./srs.md). The sibling `dod-vs-oop-dod` implements the same SRS with a different architecture and stack; do not assume parity beyond the SRS contract.

## 1. Goals

- **Be a faithful foil**, not a strawman: reflect how verbose-canonical DDD (Evans/Vernon) actually ships in production (mirrors `a real-world production ledger system`).
- **Maximize explicitness and type-safety** over development speed: rich aggregates, validators per entity, segregated repositories, bidirectional mappers.
- **Throw-based control flow**: invalid domain state is impossible to construct; errors propagate as typed exceptions.
- **Conform to the SRS** byte-for-byte (NFR-CORRECT-001) so the comparison against the DOD side is honest.

## 2. Architectural style

**Clean Architecture (layered) with DDD strategic + tactical patterns.** Each bounded context is a NestJS Module split into `domain/` → `application/` → `infrastructure/`. Dependencies point inward (infrastructure depends on application depends on domain; domain depends on nothing). See `playbook/playbook.md`.

Distinguishing choices of this implementation (the independent variables of the study):
- **Throw on first violation** — validators accumulate but the Entity/VO constructor throws (ADR-0002). No `Result`.
- **Synchronous in-memory EventBus, no Outbox** (ADR-0003).
- **Repository segregated per operation** (CQRS-ish), not one repository per aggregate.
- **Bidirectional static mappers** between domain and TypeORM persistence entities.

## 3. Bounded contexts (DDD strategic)

| Context | Responsibility | Owner module | Aggregate roots |
|---------|----------------|--------------|-----------------|
| `ledger` | Core: postings + double-entry transactions; the append-only source of truth | `src/ledger/` | `TransactionAggregate` (+ `Posting` entity) |
| `accounts` | Account lifecycle, holds, status, cached available balance + immutable balance snapshots (ADR-0006) | `src/accounts/` | `AccountAggregate`, `BalanceSnapshot` |
| `statements` | Period statement generation (CPU-bound #1) | `src/statements/` | `Statement` (read model) |
| `reconciliation` | External × internal matching (CPU-bound #2) | `src/reconciliation/` | `ReconciliationBatch` |

### Context map

Cross-context communication is **only** via domain events on the synchronous in-memory EventBus (ADR-0003). No context imports another's `domain/`.

```
┌────────────┐  TransactionPosted   ┌────────────┐
│  ledger    │─────────────────────▶│  accounts  │  (updates cached balance)
└────────────┘                      └────────────┘
      │
      │ reads postings (via shared read path)
      ▼
┌────────────┐                      ┌────────────────┐
│ statements │                      │ reconciliation │
└────────────┘                      └────────────────┘
```

`statements` and `reconciliation` are read-side consumers of the ledger's posting history; they do not emit events that other contexts consume in the MVP.

Per-context tactical detail in `sdds/sdd-<context>.md` (created as each context is built — promotion trigger: 3+ aggregates or 5+ use cases per playbook §22).

## 4. Module map

```
dod-vs-oop-classic/
├── src/
│   ├── core/                       # DDD building blocks (Entity, AggregateRoot, ValueObject,
│   │                               #   Validator, DomainError hierarchy, Specification) — throw-based
│   ├── shared/                     # cross-context VOs (Identifier, Money) + InMemoryEventBus
│   ├── ledger/                     # bounded context (domain/application/infrastructure)
│   ├── accounts/                   # bounded context
│   ├── statements/                 # bounded context (CPU-bound #1)
│   ├── reconciliation/             # bounded context (CPU-bound #2)
│   ├── app.module.ts               # composition root: imports each context module
│   └── main.ts                     # NestJS bootstrap (Express adapter)
├── tests/                          # integration / e2e (NestJS in-process)
└── docs/dod-vs-oop-classic/        # this vault
```

### Dependency rules

- `core/` depends on nothing project-specific.
- `shared/` depends on `core/`.
- A context's `domain/` depends only on `core/` + `shared/`.
- `application/` depends on its own `domain/` + ports; never on `infrastructure/`.
- `infrastructure/` depends on `application/` (implements its ports) + `domain/` (via mappers).
- A context **never** imports another context's `domain/` or `application/`. Cross-context contact is event payloads (plain data) defined in `shared/`.

## 5. Cross-cutting concerns

### 5.1 Errors

Throw-based (ADR-0002). Hierarchy rooted at `DomainError`: `InvalidPropertyError`, `InvalidValueObjectError`, `InvalidEntityError`, `InvalidIdentifierError`. Application-layer failures use `UseCaseError`. A NestJS exception filter maps the hierarchy to HTTP status codes and the SRS error shape (`{ code, message, fields? }`). No `Result<T,E>`.

### 5.2 Logging / tracing

Structured logs via NestJS logger; per-request correlation id. Not load-bearing for the study; kept minimal.

### 5.3 Configuration

In-process only. No `.env` required for the MVP; the sqlite database is `:memory:` and configured in `app.module.ts` via `TypeOrmModule.forRoot`.

### 5.4 Persistence

TypeORM over **better-sqlite3 `:memory:`** (ADR-0001) — zero disk I/O so benchmarks measure architecture/stack, not the disk. **Repository segregated per operation** (`CreateAccountRepository`, `GetAccountRepository`, …), each implemented by a TypeORM repository class. **Bidirectional static mappers** translate between domain aggregates and TypeORM persistence entities (`toPersistence` / `toDomain`). Aggregates are reconstructed via `buildExisting(props)`.

### 5.5 Domain events

Synchronous **in-memory EventBus**, **no Outbox** (ADR-0003). An aggregate collects events via `addDomainEvent`; the use case pulls them after persistence (`pullDomainEvents`) and publishes; subscribers run in-process via `Promise.all`. Cross-context consistency is therefore coupled to the process — if a handler throws after the DB commit, the event is lost (accepted trade-off for the foil; documented in ADR-0003).

### 5.6 Balance: cache + immutable snapshots (ADR-0006)

Balance has **two representations with distinct rules — the cache overwrites, the snapshot appends**:

- **Cached current balance** on `AccountAggregate` (`availableBalance: Money` + a checkpoint marker of the last posting it reflects). **Overwritten** incrementally on each `TransactionPosted` (the §6 dataflow, FEAT-003). A denormalized optimization: recomputable, never authoritative alone in an open period (SRS NFR-DATA-001).
- **`BalanceSnapshot`** — an **immutable** Value Object / read-model `{ accountId, asOf, balance, throughSeq }`, persisted **append-only**. The snapshot sequence is the retained, auditable balance history.

Current balance = **latest snapshot + Σ(postings after its `throughSeq`)**. Consolidation — producing a new snapshot as-of T — is a **domain service** (`ConsolidateAccountBalance`) because it spans `accounts` + `ledger`; it is idempotent and double-count-guarded by `throughSeq`. Open period → postings authoritative, balance derived; closed/archived period → the snapshot is the retained authority (cold-storage tiering is forward-looking, ADR-0006). The thin consolidation is also the study's honest CPU-bound contrast point (fold-over-postings vs the DOD side's SoA).

## 6. Dataflow examples

**Post a transaction (REQ-006) → balance update:**

1. `POST /transactions` → `TransactionController` builds the command DTO.
2. `PostTransactionUseCase.execute(dto)`:
   a. Builds `TransactionAggregate` via `create(...)` — validator throws `InvalidEntityError` if `Σdebits ≠ Σcredits`.
   b. Loads referenced `AccountAggregate`s via `GetAccountRepository`; rejects on currency mismatch / absence.
   c. Persists postings via `CreateTransactionRepository` (TypeORM mapper → entities).
   d. Pulls `TransactionPosted` from the aggregate and publishes on the EventBus.
3. `accounts` context's `OnTransactionPostedHandler` **overwrites** the cached available balance and advances its checkpoint marker (ADR-0006). The immutable `BalanceSnapshot` trail is untouched here — it only grows at consolidation, never on each posting.
4. Controller returns 201 with the transaction DTO.

**Generate a statement (REQ-009, CPU-bound #1):**

1. `POST /accounts/:id/statements` → `GenerateStatementUseCase`.
2. Loads postings in `[from,to]`, reduces to opening/closing balance, groups by category.
3. Returns the statement DTO. (This is where the OOP object-graph cost shows up vs the DOD side.)

## 7. Deployment

Single Node.js process (`node dist/main`), Express HTTP server on `:3000`. No external services; database is in-process sqlite memory. Container-ready but not required for the study.

## 8. Future directions (non-goals for v1)

- **`dod-vs-oop-classic-modern` variant** — same verbose DDD style but on Bun + Elysia + in-memory, to isolate the architectural variable from the stack confounder (see `../../../README.md` and the study `FAQ.md`).
- Real durable persistence (Postgres) — would introduce I/O variance; deliberately excluded.
- A true transactional Outbox — that's the DOD side's territory (ADR-0003 documents why it's absent here).

## 9. References

- [`srs.md`](./srs.md) — what we're building (shared contract)
- `sdds/` — per-context tactical design (created per context)
- `adrs/0001-stack-nestjs-typeorm-sqlite.md`, `0002-throw-on-first-violation.md`, `0003-sync-in-memory-eventbus-no-outbox.md`, `0004-money-integer-minor-units.md`, `0005-framework-agnostic-application-layer.md`, `0006-balance-snapshot-and-consolidation.md`
- `playbook/playbook.md` — verbose-canonical conventions for this project
- `../../../README.md` — study overview + sibling project
