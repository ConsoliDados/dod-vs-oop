# DOD + DDD + Small Clean Arch in TypeScript

A comparative study of two architectural approaches implementing the **same domain** (double-entry financial Ledger) with **deliberately different stacks**, reflecting real market choices. The stack confounder is explicit and addressed in the [FAQ.md](./FAQ.md).

> **Status:** work in progress. Benchmarks and detailed docs will be populated as the projects advance. See [Status](#status) below.

## The two projects

### [`dod-vs-oop-classic/`](./dod-vs-oop-classic/) — DDD + Clean Architecture (verbose-canonical)

**Stack:** NestJS + Express + TypeORM + Vitest. Verbose-canonical Evans/Vernon production style.

- `AggregateRoot<V>` + `EntityValidator<T>` base; Aggregates with `create()` / `buildExisting()` factories, 20+ getters, `private` fields
- Rich Value Objects (`Money`, `AccountId`, `Currency`) with validation in the factory
- `*UseCase` classes implementing interfaces, constructor DI via NestJS providers
- **Repository segregated per operation** (CQRS-style): `CreateAccountRepository`, `UpdateAccountRepository`, etc.
- **Bidirectional static Mappers** between domain and TypeORM entities
- **Throw on first violation** (validators accumulate, constructor raises `InvalidEntityError`) — faithful to the production style being modeled, not a strawman
- In-memory synchronous `EventBus` — no Outbox
- Soft delete with `deletedAt`
- Persistence: sqlite `:memory:` (zero disk I/O in benchmarks)

**Honest foil, not strawman.** The style is derived from a real production implementation ([a real-world production ledger system](#)), which itself extends my own DDD core template. This is what many enterprise projects do today, done well.

### [`dod-vs-oop-dod/`](./dod-vs-oop-dod/) — DDD + Data-Oriented Design + Clean Architecture Essentials

**Stack:** Bun + Elysia + Biome + Vitest (or `bun:test`). TypeScript strict. Monorepo via Bun workspaces.

Application of the patterns consolidated in the study:

- Plain readonly types (no classes for entities)
- Free-function use cases taking dependencies as parameters
- Smart Constructors with Notification Pattern → `Result<T, InvalidProperty[]>`
- `match(result, { Ok, Err })` external helper — no hidden `throw`
- Domain functions return `(NewState, Events[])` — side-effect as data
- **Transactional Outbox** for cross-context synchronization
- Bounded context = package (`ledger`, `accounts`, `statements`, `reconciliation`)
- Vertical slice + RPA (Research / Plan / Act) per feature
- Struct-of-Arrays + TypedArrays as opt-in for CPU-bound hot paths

### About the stack confounder

The stacks are deliberately different to reflect real market choices: NestJS + Express + TypeORM is where verbose DDD typically runs in production; Bun + Elysia + in-memory is the modern stack where the DOD approach makes the most sense. This means **part of the performance gain comes from the stack**, not architecture alone. The [FAQ.md](./FAQ.md) and [BENCHMARKS.md](./BENCHMARKS.md) separate the two contributions. Future work: a `dod-vs-oop-classic-modern/` variant keeping the verbose DDD style but on Bun + Elysia, to isolate the architectural variable.

## Why this study exists

Three goals:

1. **Empirically validate** whether DOD + Clean Arch Essentials delivers real gains in TypeScript (performance + DX + AI-friendly).
2. **Consolidate patterns** worth formalizing in my development playbook as an official addendum.
3. **Generate evidence** (code, benchmarks, ADRs) for a LinkedIn post about the workflow.

The chosen domain (**double-entry financial Ledger** — Account, Posting, Transaction, Statement, ReconciliationBatch) has naturally growing arrays and legitimate CPU-bound operations (statement generation, reconciliation batch). Narrative bonus: accounting has been immutable since Pacioli (1494). Immutability in DOD is not dogma — it's how the domain has worked for 530 years.

## Stack per project

### `dod-vs-oop-classic/`
- **Node.js 20+** + **NestJS** + **Express**
- **TypeORM** with sqlite `:memory:` (zero disk I/O in benchmarks)
- **Vitest** with globals
- **pnpm** as package manager
- No `@consolidados/results` here — the foil uses typed exceptions (faithful to the style)

### `dod-vs-oop-dod/`
- **Bun** — runtime + test runner
- **Elysia** — HTTP
- **TypeScript strict** + **Biome** — lint/format
- **[`@consolidados/results`](https://github.com/consolidados/results)** — `Result`/`Ok`/`Err`/external `match` (my own library)
- **In-memory `Map` repo** — zero DB variance in benchmarks

## How to run

Each project has its own README with full instructions. Quick start:

```bash
# OOP classic
cd dod-vs-oop-classic
pnpm install
pnpm dev    # boots Elysia/NestJS on :3000

# DOD + Clean Arch Essentials
cd dod-vs-oop-dod
bun install
bun run dev # boots Elysia on :3001
```

Benchmark suite (after implementation):

```bash
./run-all.sh   # boots both servers, runs autocannon + mitata + hyperfine, writes BENCHMARKS.md
```

## Documentation

- [**ARCHITECTURE.md**](./ARCHITECTURE.md) — section-by-section comparison of both projects with real code excerpts *(post-implementation)*
- [**BENCHMARKS.md**](./BENCHMARKS.md) — methodology, results table, chart, caveats *(post-harness)*
- [**POST.md**](./POST.md) — final LinkedIn post script with real numbers *(post-harness)*
- [**FAQ.md**](./FAQ.md) — preempts common counter-arguments *(optional)*

## Working methodology

This repo follows my development playbook for human + AI agents collaborating on the same project:

- **Vertical slice + RPA** (Research / Plan / Act) per feature
- **Bounded context = package** (workspaces); cross-context communication only via domain events
- **Smart Constructors with Notification Pattern** instead of exceptions (DOD project only — the OOP project deliberately uses throw)
- **`Result<T, E>` + external `match` helper** — never throws (DOD project only)

The `dod-vs-oop-classic/` project uses its **own playbook** (verbose, Evans/Vernon style) to ensure the foil is faithful to traditional DDD, not strawmanned.

### Fair-comparison guarantee

Both projects share a **conformance suite** asserting byte-identical JSON responses for the same HTTP fixtures. Performance comparison is only defensible after conformance passes — any divergence is a bug and gets fixed before measuring.

Benchmark fairness controls: pinned Bun/Node versions, same in-memory persistence model (no DB variance), fixtures generated once and deep-cloned per iteration (prevents hidden-class caching from favoring either side), warmup discarded, `taskset -c 0`, A and B alternated in the same run to avoid thermal drift.

## Status

- [ ] Scaffold `dod-vs-oop-classic/`
- [ ] Scaffold `dod-vs-oop-dod/`
- [ ] Implement Project B (DOD reference) — slice by slice via RPA
- [ ] Implement Project A (OOP foil) — mirroring B's endpoints and semantics
- [ ] Conformance suite passing
- [ ] Benchmark harness + populated `BENCHMARKS.md`
- [ ] `ARCHITECTURE.md` with real excerpts
- [ ] `POST.md` extracted with real numbers

## Author

Johnny Carreiro — feedback welcome via Issues or LinkedIn.

## License

MIT (to be confirmed).
