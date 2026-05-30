# DDD comparative study — Classic, Modern, DOD

A comparative study of **three** implementations of the **same domain** (double-entry financial Ledger), each a different way to **materialise DDD**. All three share the same SRS (shared contract); each has its own SAD + SDDs (per-implementation tactical decisions).

The three-way design isolates confounders so the comparison is honest:

| Pair | What it isolates |
|---|---|
| `ddd-classic` vs `ddd-modern` | **The stack** — architecture held constant (verbose-canonical DDD + Clean Arch), only the runtime / DB changes |
| `ddd-modern` vs `ddd-dod` | **The architecture** — stack held constant (Bun + Elysia + Drizzle), only the materialisation changes |
| `ddd-classic` vs `ddd-dod` | The brutal real-world comparison — both axes change at once (the "natural mode") |

> **Status:** `ddd-classic` is implemented through EPIC-002 (ledger core). `ddd-modern` and `ddd-dod` are next. See [Status](#status) below.

## The three projects

### [`ddd-classic/`](./ddd-classic/) — DDD + Clean Architecture (verbose-canonical)

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

### [`ddd-modern/`](./ddd-modern/) — Same DDD, modern stack (the bridge / fair fight)

**Stack:** Bun + Elysia + Drizzle + Vitest. **Same** verbose-canonical DDD as `ddd-classic` — same aggregates, same validators, same throw-based discipline, same segregated repositories, same bidirectional mappers. Only the **infrastructure layer** is rewritten on the modern stack.

This is the **fair-fight middle term**: it eats the stack-confounder hit so that comparing `ddd-modern` vs `ddd-dod` truly isolates the *architectural* change. Without it, any speedup of `ddd-dod` could be ambiguously attributed to "the better runtime" or "the better data layout".

### [`ddd-dod/`](./ddd-dod/) — DDD + Data-Oriented Design + Clean Architecture Essentials

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

### About the stack confounder — addressed by the three-way design

The "natural mode" comparison (`ddd-classic` vs `ddd-dod`) mixes two axes: NestJS + Express + TypeORM is where verbose DDD typically runs in production; Bun + Elysia + Drizzle is the modern stack where DOD makes the most sense. So part of any speedup would come from the stack, not architecture alone.

`ddd-modern` exists exactly to disentangle the two. By keeping verbose-canonical DDD intact while moving to the modern stack, it lets you read the three-way result honestly: `ddd-classic → ddd-modern` shows what the *stack* alone buys you; `ddd-modern → ddd-dod` shows what the *architecture* alone buys you on top of that. The [FAQ.md](./FAQ.md) and [BENCHMARKS.md](./BENCHMARKS.md) report both deltas.

## Why this study exists

Three goals:

1. **Empirically validate** whether DOD + Clean Arch Essentials delivers real gains in TypeScript (performance + DX + AI-friendly).
2. **Consolidate patterns** worth formalizing in my development playbook as an official addendum.
3. **Generate evidence** (code, benchmarks, ADRs) for a LinkedIn post about the workflow.

The chosen domain (**double-entry financial Ledger** — Account, Posting, Transaction, Statement, ReconciliationBatch) has naturally growing arrays and legitimate CPU-bound operations (statement generation, reconciliation batch). Narrative bonus: accounting has been immutable since Pacioli (1494). Immutability in DOD is not dogma — it's how the domain has worked for 530 years.

## Stack per project

### `ddd-classic/`
- **Node.js 22+** + **NestJS** + **Express**
- **TypeORM** with sqlite `:memory:` (zero disk I/O in benchmarks)
- **Vitest** with globals
- **pnpm** as package manager
- No `@consolidados/results` here — the foil uses typed exceptions (faithful to the style)

### `ddd-modern/`
- **Bun** + **Elysia** + **Drizzle** (sqlite `:memory:`)
- Same architecture as `ddd-classic`; only infrastructure changes
- Throws (mirroring classic) — no `Result` here either

### `ddd-dod/`
- **Bun** — runtime + test runner
- **Elysia** — HTTP
- **Drizzle** with sqlite `:memory:` (parity with `ddd-modern` for the architecture-isolating comparison)
- **TypeScript strict** + **Biome** — lint/format
- **[`@consolidados/results`](https://github.com/consolidados/results)** — `Result`/`Ok`/`Err`/external `match` (my own library)

## How to run

Each project has its own README with full instructions. Backend ports follow the project convention: **3000 is reserved for frontend; backends start at 3333** (`PORT` env override always available). Quick start:

```bash
# Classic — NestJS + TypeORM
cd ddd-classic
pnpm install
pnpm start:prod         # binds 3333 by default

# Modern — Bun + Elysia + Drizzle, same architecture (when scaffolded)
cd ddd-modern
bun install
bun run start           # binds 3334

# DOD — Bun + Elysia + Drizzle, data-oriented (when scaffolded)
cd ddd-dod
bun install
bun run start           # binds 3335
```

Conformance smoke (shared harness):

```bash
# In a separate shell, against any of the three:
cd ddd-classic && PORT=3333 pnpm smoke
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

- **Vertical slice + RPA** — *Research → Plan → Act* per feature (**not** Robotic Process Automation): a documentation-first agentic loop where the spec/ADR/design chain precedes any code — the opposite of ad-hoc "vibe coding"
- **Bounded context = package** (workspaces); cross-context communication only via domain events
- **Smart Constructors with Notification Pattern** instead of exceptions (DOD project only — the OOP project deliberately uses throw)
- **`Result<T, E>` + external `match` helper** — never throws (DOD project only)

The `ddd-classic/` project uses its **own playbook** (verbose, Evans/Vernon style) to ensure the foil is faithful to traditional DDD, not strawmanned.

### Fair-comparison guarantee

Both projects share a **conformance suite** asserting byte-identical JSON responses for the same HTTP fixtures. Performance comparison is only defensible after conformance passes — any divergence is a bug and gets fixed before measuring.

Benchmark fairness controls: pinned Bun/Node versions, same in-memory persistence model (no DB variance), fixtures generated once and deep-cloned per iteration (prevents hidden-class caching from favoring either side), warmup discarded, `taskset -c 0`, A and B alternated in the same run to avoid thermal drift.

## Status

- [x] Scaffold `ddd-classic/`
- [x] **EPIC-002 (ledger core)** in `ddd-classic/` — Account / Posting / Transaction / Balance / lifecycle / reversal / consolidation; 170 tests; smoke harness; sad-path catalogue
- [ ] Scaffold `ddd-modern/`
- [ ] Implement EPIC-002 in `ddd-modern/` — same architecture, modern stack
- [ ] Scaffold `ddd-dod/`
- [ ] Implement EPIC-002 in `ddd-dod/` — DOD + Clean Arch Essentials, `Result`-based
- [ ] Conformance suite (NFR-CORRECT-001 byte-identical JSON across all three)
- [ ] Benchmark harness + populated `BENCHMARKS.md`
- [ ] `ARCHITECTURE.md` with real excerpts from each
- [ ] `POST.md` extracted with real numbers

## Author

Johnny Carreiro — feedback welcome via Issues or LinkedIn.

## License

MIT (to be confirmed).
