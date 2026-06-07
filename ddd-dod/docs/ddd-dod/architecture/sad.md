# DDD DOD — Software Architecture Description (SAD)

Strategic-level architecture. The "what fits where" view. Tactical detail per area lives in `sdds/sdd-<area>.md`.

> **Implementation-specific.** This SAD describes the *how* for the **Data-Oriented Design + Clean Architecture Essentials** implementation of the shared [`srs.md`](./srs.md). The sibling `ddd-classic` implements the same SRS in verbose-canonical OOP; `ddd-modern` will implement it in the classic style on this stack. Do not assume parity beyond the SRS contract.

## 1. Goals

- **Be an honest counterpart**, not a caricature: reflect how a Data-Oriented, `Result`-based functional-core design actually ships — rich behavior expressed as pure functions over plain data, not an anemic CRUD layer.
- **Maximize explicitness via values and types** while dropping OOP ceremony: plain readonly types instead of classes, free-function use cases instead of injected service objects, smart constructors instead of throwing constructors.
- **Error-as-value control flow**: invalid domain state is reported, not thrown. Validation accumulates (Notification pattern) and surfaces as `Result<T, E>`; the boundary `match`es once.
- **Conform to the SRS** byte-for-byte (NFR-CORRECT-001) so the comparison against the OOP side is honest — the conformance suite asserts byte-identical JSON for the same fixtures.

## 2. Architectural style

**Clean Architecture Essentials + Data-Oriented Design.** Dependencies point inward (infra depends on application depends on domain; domain depends on nothing). Although `ddd-dod` runs the **small** branching tier (§16.2), its layout deliberately adopts the **medium+** infra-free split (ADR-0014) — tier sets the floor, not the ceiling, and the study needs a provably infra-free core. The layers are split *across packages* so the functional core is **provably infra-free** (ADR-0014): the **context package** (`packages/modules/<ctx>`) holds `domain/` + `application/` only — the repository **port** lives in `application`; **outbound adapters** (persistence) live in a dedicated `@ddd-dod/infra` package; **inbound adapters** (HTTP routes) live in the delivery app (`apps/api`). The three "infra"s — inbound (driving), outbound (driven), and technical ports (`platform`) — are placed by kind and scale by tier (prototype→large). See `playbook/playbook-base.md` §5/§21, ADR-0014, and `PLAYBOOK-LEARNINGS.md` for the per-tier folder organization.

Distinguishing choices of this implementation (the independent variables of the study — the inverse of `ddd-classic`'s SAD §2):

- **Plain readonly types, no classes for entities** (pattern #1). State is data: `interface Account { readonly status: AccountStatus; ... }`. Behavior lives in module functions, not methods.
- **Discriminated unions for state** (pattern #2): `{ kind: 'active' } | { kind: 'frozen'; since: Date }` instead of a status flag + scattered guards.
- **Smart Constructors with the Notification pattern** (pattern #3): constructors are factory functions returning `Result<T, InvalidProperty[]>`; errors **accumulate** — never `throw`, never `return null`, never early-return on the first violation. The caller gets the full validation set.
- **`Result<T, E>` + external `match` helper** (pattern #6) via `@consolidados/results` (ADR-0002, ADR-0005). No hidden `throw` in domain/application. The use-case flow ends in a single `match`; `if (result.isErr())` is reserved for the imperative runner/boundary, not the use-case body.
- **Free-function use cases** (pattern #4): `doX(input, deps): Promise<Result<Out, Err>>`. Dependencies are parameters, never constructed inside, never decorated. Wiring happens once at the composition root (ADR-0004).
- **Side-effect as data** (pattern #5): domain transition functions return `(NewState, Events[])`. The domain never receives a `publisher`/`bus`/`client`; only data in, data out. The use case decides what to persist and emit.
- **Transactional Outbox for cross-context sync** (pattern #7, ADR-0003): events are persisted in the same transaction as the state change; a separate dispatcher drains the outbox. Contrast `ddd-classic`'s synchronous in-memory EventBus.
- **Repository as hydrator, not active ORM** (pattern #8): repositories return plain data snapshots — no proxies, no lazy loading, no methods on returned objects.
- **Bounded context = package** (pattern #9): cross-context communication only via published event types from the shared kernel.
- **SoA + TypedArrays opt-in on CPU-bound hot paths** (pattern #10): Struct-of-Arrays is behind an explicit flag/path, never the default — an optimization for statement generation and reconciliation, not a general style.

## 3. Bounded contexts (DDD strategic)

Identical domain boundaries to `ddd-classic` (the SRS is shared); only the realization differs.

| # | Context | Role | Owns | CPU-bound? |
|---|---------|------|------|------------|
| 1 | `ledger` | Postings + double-entry transactions; reversal | `packages/modules/ledger/` | — |
| 2 | `accounts` | Aggregate balance, holds, lifecycle (freeze/activate/close) | `packages/modules/accounts/` | — |
| 3 | `statements` | Period statement generation | `packages/modules/statements/` | yes (#1) |
| 4 | `reconciliation` | External × internal matching | `packages/modules/reconciliation/` | yes (#2) |

**Context map.** `accounts` reflects balance from `ledger`'s `TransactionPosted` event (cross-context, via outbox + idempotent handler). `statements` and `reconciliation` read postings through published ports. No context reaches into another's internals — only published event types (in `shared-kernel`) cross the boundary.

## 4. Package map (Bun workspace monorepo)

```
ddd-dod/
├─ apps/
│  └─ api/                 Elysia delivery + composition root; INBOUND adapters in src/http/modules/<ctx> (ADR-0014)
└─ packages/
   ├─ types/               results-globals wrapper (@ddd-dod/types): ./globals + ./globals-types; sole @consolidados/results dependant
   ├─ platform/            technical, ZERO domain: logger, config, di, db (port + connection), outbox runtime, clock
   ├─ shared-kernel/       shared DOMAIN: Money (integer minor units), event contracts, branded ids, Notification error shapes
   ├─ modules/             CORE per bounded context — domain/ + application/ only, ZERO infra dep (port lives in application)
   │  ├─ ledger/
   │  ├─ accounts/
   │  ├─ statements/
   │  └─ reconciliation/
   └─ infra/               @ddd-dod/infra — OUTBOUND adapters: src/modules/<ctx>/{sqlite,pg}; subpath-exported per ctx
```

- **`types/`** is the results-globals wrapper (ADR-0005): the **only** package that depends on `@consolidados/results`. It exposes `./globals` (runtime value registration) and `./globals-types` (ambient `Result`/`Option` types). Every other package gets `Result`/`Option`/`Ok`/`Err`/`Some`/`None`/`match` ambiently — no direct results import.
- **`platform/`** carries no domain knowledge. It is the inverse-dependency sink: modules depend on its *ports* (e.g. `Clock`, `Logger`, `Outbox`) but the concrete adapters are built and injected at the composition root. The logger is functional (closure-based factory `createLogger`); the DI container is token-based and used only in `apps/api`.
- **`shared-kernel/`** is pure domain shared by all contexts — `Money`, branded `AccountId`/`TransactionId`, the published-event contracts, and the Notification error shapes (`InvalidProperty`). It depends on nothing infra.
- **`modules/<context>/`** are the **core** — `domain/` + `application/` only, **zero infra dependency** (ADR-0014). Each exposes a public `index.ts` with its use-cases and its repository **port** (a hydrator signature, pattern #8); cross-package imports never reach into `<pkg>/src/...`.
- **`infra/`** (`@ddd-dod/infra`) holds the **outbound adapters** — `src/modules/<context>/{sqlite,pg}` implementing each context's port, subpath-exported (e.g. `@ddd-dod/infra/ledger`). Depends on each core + `platform`; the composition root wires port→adapter by driver (ADR-0012/0014). **Inbound** adapters (HTTP routes) live in `apps/api/src/http`, never here.

## 5. Cross-cutting concerns

- **Errors** — `Result<T, E>` end to end (ADR-0002). Domain/validation errors use the **Notification** tagged shape (`{ type, field, ... }`, accumulated). Operational/port errors use a **Rust-enum-style** union (string variants + single-key object variants, e.g. `'NotFound' | { Infra: { cause } }`), constructed via factory objects and `match`ed. No `throw` except at infra boundaries, where native exceptions are caught and converted to `Err` (a `tryAsync` wrapper).
- **Logging** — structured JSON via the functional `platform` logger; fields not strings; one `child` logger per request carrying a `requestId`; logging happens at boundaries (use-case instrumentation, adapters), never inside pure domain functions.
- **Config** — parsed and validated with Zod `.strict()` at process start (untrusted external input). `PORT` defaults to `3333` (never `3000`, reserved for a frontend).
- **Validation scope (ADR-0006)** — Zod guards **external untrusted boundaries** (HTTP body, env, config). It does **not** guard the read path of a context reading its own tables: the context is the sole writer, the domain guarantees invariants on write, and schema drift is a migration concern, not a runtime guard. Repository rows are typed interfaces, not re-parsed.
- **Persistence** — Drizzle; the driver comes from the **resolved** `DATABASE_URL` (ADR-0012, corrected): sqlite `:memory:` **only under `NODE_ENV=test`** (Phase-2 benchmark parity with `ddd-modern`, in-process), otherwise a real URL or `DB_*` parts (Postgres) — **required outside test**. `:memory:` is never a general fallback. Repositories are hydrators (pattern #8).
- **Domain events** — published contracts in `shared-kernel`, versioned (`v: 1`); never mutate a published shape (deprecate + add). Delivered via the outbox (ADR-0003).

## 6. Dataflow example — post a transaction

1. `apps/api` (Elysia) Zod-parses the body → calls `postTransaction(input, deps)`.
2. The use case calls the pure domain function `applyTransaction(...) → [Transaction, Posting[], Event[]]` (side-effect as data).
3. On `Ok`, the use case calls `repo.saveWithEvents(tx, postings, events)` — the adapter persists state **and** inserts the outbox rows in one transaction.
4. The use case returns `Result<Output, AppError>`; the boundary `match`es once to an HTTP response (status + body).
5. The outbox dispatcher (separate) drains pending events → the `accounts` idempotent handler updates the cached balance.

## 7. Deployment

Single Bun process serving the Elysia API; sqlite `:memory:` per process (study/benchmark context, no durability guarantee — matches SRS §2.2 out-of-scope). No external services.

## 8. Future directions

- `ddd-modern` — the verbose-canonical OOP architecture on this same Bun/Elysia/Drizzle stack, isolating the stack confounder against `ddd-classic`.
- SoA/TypedArray variants for statement/reconciliation hot paths, measured against the AoS default.
- Conformance suite (NFR-CORRECT-001) + benchmark harness shared across all three implementations.

## 9. References

- `./srs.md` — shared domain contract (byte-for-byte identical to `ddd-classic`'s, modulo title)
- `./adrs/` — locked-in decisions (ADR-0001..0006)
- `./playbook/playbook-base.md`, `./playbook/playbook-ts.md` — normative conventions
- `../../README.md` — study overview and fair-comparison guarantee
