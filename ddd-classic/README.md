# `ddd-classic`

Verbose-canonical DDD (Evans/Vernon) — **OOP foil** of the comparative study [DOD + DDD + Small Clean Arch](../README.md).

> Mirrors the production style of `a real-world production ledger system`: NestJS + Express + TypeORM, rich AggregateRoot with 300+ lines, `create()` / `buildExisting()` factories, classed validators per entity, throw on first violation, bidirectional mappers, repository segregated per operation, in-memory EventBus with no Outbox.

## Stack

- **Node.js 20+**
- **NestJS 11** with Express adapter
- **TypeORM** + **better-sqlite3** (`:memory:` in benchmarks)
- **TypeScript** strictest (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`)
- **Vitest 4** + **Biome 2** (replace the Jest + ESLint + Prettier defaults from Nest CLI)
- **pnpm** as package manager

## How to run

```bash
pnpm install               # install deps (already done during scaffold)
pnpm typecheck             # tsc --noEmit
pnpm test                  # vitest run (unit + e2e in-process)
pnpm test:watch            # watch mode
pnpm test:coverage         # coverage report
pnpm dev                   # nest start --watch (HTTP on :3000)
pnpm build                 # compile to dist/
pnpm start:prod            # node dist/main
pnpm lint                  # biome check
pnpm lint:fix              # biome check --write
pnpm check                 # biome check + typecheck
```

## Layout

```
AGENTS.md, CLAUDE.md (symlink)     # entry point for agents (declarations)
src/
├── core/                          # DDD building blocks (throw-based override of ddd-templates)
├── shared/                        # cross-context: VOs (Identifier, Money) + in-memory EventBus
├── <ledger>/, <accounts>/, ...    # bounded contexts (TBD per slice)
├── app.{controller,module,service}.ts, main.ts
test/
└── app.e2e.spec.ts                # NestJS in-process smoke
docs/ddd-classic/           # Obsidian vault (medium tier, Mode B)
├── methodology.md                 # operating guide (Day 1 read)
├── .obsidian/                     # Catppuccin + 5 plugins (dataview, templater, tasks, kanban, omnisearch)
├── architecture/
│   ├── srs.md, sad.md, data-model.md, threat-model.md, open-questions.md
│   ├── adrs/, sdds/               # decisions and per-area tactical design
│   └── playbook/
│       ├── playbook.md            # REPLACES the template's playbook-base + playbook-ts — verbose-canonical throw-based OOP
│       └── agents/                # AGENTS.template.md + module-AGENTS.template.md
├── backlogs/, roadmap/, epics/    # Markdown cards + Obsidian Kanban dashboards
└── sprints/                       # empty in Mode B (features live in epics/<id>/features/<id>/)
.github/workflows/
└── lint-and-typecheck-ts.yml      # CI (pnpm + Vitest)
```

## Overrides vs `ddd-templates`

The core was copied from `~/Dev/projects/ddd-templates/core/core` and modified to reflect the production reference's production style:

| Aspect | `ddd-templates` (original) | `ddd-classic` (this project) |
|---|---|---|
| Validation flow | `validate()` returns `Result<T, E>` | `validate(): void` — **throws** on first invalid instantiation |
| Factory return | `create()` returns `Result<T, E>` | `create()` returns `T` directly, throws on error |
| Error library | depends on `@consolidados/results` | no dep, throw-based |
| Repository | generic `Repository<T, ID, E>` | interfaces segregated per operation (CQRS-style) — TBD per slice |
| Error infra | `error-config`, `error-factory`, `error-mapper`, `error-catalog` | removed — only the `DomainError` hierarchy |
| Spec files | removed inherited `.spec.ts`; project-specific smoke in `src/core/__tests__/smoke.spec.ts` | |

Full details in [`docs/ddd-classic/architecture/playbook/playbook.md`](./docs/ddd-classic/architecture/playbook/playbook.md).

## Status

- [x] Scaffold NestJS + Vitest + Biome + TypeORM + sqlite memory
- [x] Core copied from `ddd-templates` with 5 throw-based overrides
- [x] Shared VOs (`Identifier`, `Money`)
- [x] Synchronous in-memory EventBus (no Outbox)
- [x] Smoke tests passing: `pnpm test` → 12/12 (11 core + 1 NestJS e2e)
- [x] `pnpm typecheck` clean
- [x] `project_templates` applied: AGENTS.md + CLAUDE.md at root, `docs/ddd-classic/` with Obsidian vault, single playbook replacing the template's base+ts, CI workflow, methodology.md, epics/sprints/backlogs/roadmap, ADRs/SDDs scaffolds
- [x] Foundational docs: SRS (shared), SAD, ADR-0001..0003
- [x] EPIC-001 (bootstrap) documented; EPIC-002 (ledger-core) planned with FEAT-001 RPA
- [ ] EPIC-002 ledger-core: open-account → post-transaction → reflect-balance → reverse → list-postings
- [ ] Bounded context `statements` (CPU-bound #1) — later epic
- [ ] Bounded context `reconciliation` (CPU-bound #2) — later epic
- [ ] Conformance suite vs `ddd-dod`

## Entry points

1. `AGENTS.md` (root) — declarations + project-specific overrides (tier, mode, errors, contexts, scripts)
2. [`docs/ddd-classic/methodology.md`](./docs/ddd-classic/methodology.md) — operating guide (narrative): Day 1 onboarding, lifecycle, recipes
3. [`docs/ddd-classic/architecture/playbook/playbook.md`](./docs/ddd-classic/architecture/playbook/playbook.md) — single project playbook (replaces base+ts from the template — verbose-canonical throw-based OOP)
4. [`docs/ddd-classic/architecture/sad.md`](./docs/ddd-classic/architecture/sad.md) / [`srs.md`](./docs/ddd-classic/architecture/srs.md) — architecture and requirements
5. [`docs/ddd-classic/epics/`](./docs/ddd-classic/epics/) — active epic + `exits_with` + Mode B features

## Links

- [Study README](../README.md) — overview + sibling project
- External references: `~/Dev/projects/ddd-templates` (DDD core template), `a real-world production ledger system` (mirrored production style), `~/Dev/project_templates` (methodology + tiers)
