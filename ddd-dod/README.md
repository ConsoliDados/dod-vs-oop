# `ddd-dod`

Data-Oriented Design + Clean Architecture Essentials — the **functional-core counterpart** of the comparative study [DOD + DDD + Small Clean Arch](../README.md).

> The inverse of `ddd-classic`: plain readonly types (no classes for entities), free-function use cases taking dependencies as parameters, smart constructors with the Notification pattern → `Result<T, InvalidProperty[]>`, `match(result, { Ok, Err })` with no hidden `throw`, domain functions returning `(NewState, Events[])` (side-effect as data), and a transactional outbox for cross-context sync. Same shared SRS, opposite realization.

## Stack

- **Bun** — runtime + test runner (`bun:test`)
- **Elysia** — HTTP
- **Drizzle** + **better-sqlite (`:memory:`)** — in-process persistence (parity with `ddd-modern` for the architecture-isolating comparison)
- **TypeScript** strictest (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) + **Biome 2** (lint/format)
- **[`@consolidados/results`](https://github.com/consolidados/results)** `^0.5.0` — `Result`/`Ok`/`Err`/`Some`/`None`/external `match`, activated via globals

## How to run

```bash
bun install                # install deps (workspaces)
bun run typecheck          # tsc --noEmit across workspaces
bun test                   # bun:test (unit + integration)
bun run dev                # Elysia API (HTTP on PORT, default 3333)
bun run lint               # biome check
bun run check              # biome check + typecheck
```

## Layout

```
AGENTS.md, CLAUDE.md (symlink)     # entry point for agents (declarations)
apps/
└── api/                           # Elysia HTTP entry + composition root (DI container)
packages/
├── types/                         # @consolidados/results globals wrapper (./globals + ./globals-types)
├── platform/                      # technical, ZERO domain: logger, di, config, db, outbox, clock
├── shared-kernel/                 # shared domain: Money, branded ids, event contracts, Notification errors
└── modules/
    ├── ledger/                    # postings + double-entry transactions
    ├── accounts/                  # balance, holds, lifecycle
    ├── statements/                # statement generation (CPU-bound)
    └── reconciliation/            # external × internal matching (CPU-bound)
docs/ddd-dod/                      # architecture (SRS/SAD/ADRs), playbooks, epics, methodology
```

## Architecture at a glance

The ten DOD patterns this implementation applies (see `docs/ddd-dod/architecture/sad.md` §2):

1. Plain readonly types, no classes for entities
2. Discriminated unions for state
3. Smart constructors with the Notification pattern (accumulate, never throw)
4. Free-function use cases (deps as parameters)
5. Side-effect as data — domain returns `(NewState, Events[])`
6. `match` as an external helper (no method on `Result`)
7. Transactional Outbox for cross-context synchronization
8. Repository as hydrator (plain snapshots, no active ORM)
9. Bounded context = package; cross-context only via published events
10. Struct-of-Arrays + TypedArrays as opt-in for CPU-bound hot paths

## Status

**MILESTONE-001 (bootstrap)** — EPIC-001 (scaffold) done; EPIC-002 (active-foundation: config, logger, DI container, `bootstrap()`, Elysia app) next. Domain features land later in EPIC-003 (ledger-core). See `docs/ddd-dod/roadmap/milestones/bootstrap.md` and `docs/ddd-dod/epics/`.

## Author

Johnny Carreiro — feedback welcome via Issues or LinkedIn.
