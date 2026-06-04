# AGENTS.md — DDD DOD (project root)

Read this before writing any code. Conventions are normative; deviate only by flagging in chat first.

## What this repo is

**DDD DOD** — the **Data-Oriented Design + Clean Architecture Essentials** implementation of the comparative study [DOD + DDD + Small Clean Arch](../README.md). A **Bun workspace monorepo** (Bun + Elysia + Drizzle + sqlite `:memory:`) implementing the **double-entry financial Ledger** domain (Account, Posting, Transaction, Statement, Reconciliation) in functional-core style — plain readonly types, free-function use cases, smart constructors with the Notification pattern, `Result<T, E>` + external `match` (no `throw`), domain functions returning `(NewState, Events[])`, transactional outbox for cross-context sync.

It is the **counterpart** of the sibling `ddd-classic` (verbose-canonical OOP foil). Same shared SRS, opposite realization. `ddd-modern` (planned) will run the classic architecture on this stack to isolate the stack confounder.

Canonical architecture docs live under `docs/ddd-dod/architecture/` — kept in sync with the code. If something there is wrong or outdated, flag in chat or open a PR; never let code and docs diverge silently.

## Methodology

This project follows the conventions in `docs/ddd-dod/architecture/playbook/` — the template's **original** `playbook-base.md` + `playbook-ts.md` (unlike `ddd-classic`, which replaced them with a single verbose playbook).

> **Lapidation note.** This project refines DOD/functional-core patterns observed in the author's reference designs. Those refinements are applied **here, in code and ADRs** — they are **not** edited into the shared template mid-project. See `open-questions.md` OQ-001; what proves out gets PR'd into the template at project close.

**Two axes, one-way reference (management → docs).** DOCS in `architecture/`: `SRS → SAD (+ADRs) → SDD → FRD` (FRD is the last doc; docs are management-agnostic). MANAGEMENT in roadmap/board/epics: `Milestone → Epic → Feature → Task`, referencing docs by id (`sdd:`, `frd:`).

- **Tier**: medium — see playbook §21 (layered application).
- **Feature placement mode**: B — epic-bound — see playbook §23. 1 contributor (kanban-flow).
- **Sprint planning**: collapsed into the active epic's README (Mode B).
- **Documentation language**: English (default). Code is always English.
- **Active artefacts** (cross-reference promotion triggers in playbook §22):
  - [ ] `architecture/sdds/` — created per context when its trigger fires (3+ ADRs, 5+ public use cases, 3+ aggregates).
  - [ ] `architecture/frds/` — split out per functionality at medium+ when validation/acceptance detail warrants it.
  - [ ] `architecture/data-model.md` — promotion trigger: versioned migrations, etc.
  - [ ] `architecture/threat-model.md` — N/A (didactic study, no sensitive data).
  - [ ] `dev-pipeline/` — N/A (large tier only).

**RPA is a mental discipline, not files** — Research → Plan → Act produces exactly one artifact per node (the flat `sdd-<slug>.md`, the flat `frd-<slug>.md`, or the Feature's code + `README.md`). No `research.md`/`plan.md`/`act.md`; durable decisions go to an ADR. (This differs from `ddd-classic`, which used per-feature R/P/A files — docs is itself a comparison axis of the study.)

When any promotion trigger fires, log the moment in `open-questions.md` (resolved section) or the active epic's progress log.

## Agent-first architecture

Authored by AI agents collaborating with the human author. The agent's context window is the binding constraint, so:

- **Distinctive, greppable names** (target: <5 hits project-wide for unique identifiers).
- **Small, focused files** (≤ 500 lines, ideally 200–300).
- **Rich doc-comments on domain code** so agents don't have to chase definitions.
- **AGENTS.md at every module/context root** so agents read context before editing.

Read [[docs/ddd-dod/architecture/playbook/playbook-base.md]] and [[docs/ddd-dod/architecture/playbook/playbook-ts.md]] before writing code.

## Priority reading

1. This `AGENTS.md` — declarations + project-specific overrides.
2. `docs/ddd-dod/methodology.md` — operating guide (narrative).
3. `docs/ddd-dod/architecture/playbook/playbook-base.md` — normative language-agnostic conventions.
4. `docs/ddd-dod/architecture/playbook/playbook-ts.md` — TypeScript/Bun rules and examples.
5. `docs/ddd-dod/architecture/sad.md` — system architecture (the DOD independent variables).
6. `docs/ddd-dod/architecture/srs.md` — requirements contract (shared, byte-for-byte with `ddd-classic`).
7. `docs/ddd-dod/architecture/adrs/` — locked-in decisions (ADR-0001..0011); check before deviating.
8. `docs/ddd-dod/architecture/sdds/` (when present) — per-domain tactical bible.
9. `docs/ddd-dod/epics/` — active epic + `exits_with` + Mode B features.
10. `../README.md` — public overview of the study; `../../PLAN.md` — internal source of truth.

If a decision in an ADR conflicts with what you intend to do, either follow the ADR or flag the discrepancy. Never silently deviate.

## Bounded contexts

| # | Context | Role | Owns |
|---|---------|------|------|
| 1 | `ledger` | Postings + double-entry transactions; reversal | `packages/modules/ledger/` |
| 2 | `accounts` | Aggregate balance, holds, status (lifecycle) | `packages/modules/accounts/` |
| 3 | `statements` | Statement generation (CPU-bound #1) | `packages/modules/statements/` |
| 4 | `reconciliation` | External × internal matching (CPU-bound #2) | `packages/modules/reconciliation/` |

See `docs/ddd-dod/architecture/sad.md` for context boundaries; `sdds/sdd-<context>.md` for the tactical design of each (once promoted).

## Key directories

| Path | Purpose |
|------|---------|
| `apps/api/` | Elysia HTTP entry + **composition root** (wires the DI container; PORT default 3333) |
| `packages/types/` | Results-globals wrapper (`@ddd-dod/types`): `./globals` (runtime values) + `./globals-types` (ambient `Result`/`Option`) — the only package that depends on `@consolidados/results` (ADR-0005) |
| `packages/platform/` | Technical, ZERO domain: functional logger, token-based DI container, config (Zod), db (Drizzle), outbox runtime, clock |
| `packages/shared-kernel/` | Shared **domain**: `Money` (integer minor units), branded ids, published event contracts, Notification error shapes |
| `packages/modules/<context>/` | Bounded context: `src/{domain,application,infra}` + `index.ts` + `error.ts` |
| `docs/ddd-dod/` | Architecture, playbooks, epics, methodology |
| `../.github/workflows/ci-ddd-dod.yml` | CI (repo root): biome + typecheck + tests on every PR touching `ddd-dod/**` |

## Conventions

### Code style

- **Lint + format**: Biome 2 — `bun run lint` / `bun run format`.
- **Indentation**: 2 spaces (TS, JSON, YAML, MD).
- **TypeScript strictest**: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.

### Commits

Conventional Commits per playbook §16.1. Scopes for this repo:

`platform`, `shared-kernel`, `ledger`, `accounts`, `statements`, `reconciliation`, `api`, `(meta)`, `(docs)`, `(ci)`.

### Branching — three-tier flow (adjusted Git Flow)

`ddd-dod` is a sub-project of the public `dod-vs-oop` repo (shared git; CI is per-example at the repo root). We extend playbook §16.2 with a **milestone → epic → feature** branch hierarchy:

```
dev
└── milestone/<slug>            landing branch for a milestone (e.g. milestone/bootstrap)
    └── epic/<slug>             one per epic (e.g. epic/scaffold, epic/active-foundation)
        └── feat/<slug>         one per feature (e.g. feat/logger)
```

**Merge policy (non-negotiable):**
- `feat/<slug>` → `epic/<slug>` — **local merge** (no PR).
- `epic/<slug>` → `milestone/<slug>` — **PR**.
- `milestone/<slug>` → `dev` — **PR**.
- `main` — production; receives `dev` per release (playbook §16.4).

Branch slugs are **unscoped** (`epic/active-foundation`, not `epic/ddd-dod-active-foundation`).

### Bootstrap-phase exception

Within MILESTONE-001 (bootstrap), the **scaffold** epic (`epic/scaffold`) is allowed direct commits (no per-feature PRs) — it is pure structure/config. From EPIC-002 (active-foundation) onward, every feature follows the three-tier flow above (feat → epic local, epic → milestone PR).

### Errors

**Error-as-value** (ADR-0002, the inverse of `ddd-classic`):
- Smart constructors / domain transitions accumulate validation errors (Notification pattern) and return `Result<T, E>` — never `throw`, never `return null`, never early-return on first violation.
- Use-case flow ends in a single `match(result, { Ok, Err })`. `if (result.isErr())` is for the imperative runner/boundary only, never a use-case body.
- Infra boundaries catch native exceptions and convert to `Err` (`tryAsync`).
- Results globals via the `@ddd-dod/types` wrapper (ADR-0005): `Result`/`Option` types **and** `Ok`/`Err`/`Some`/`None`/`match` values are ambient everywhere — no per-file import. Runtime registration is `import "@ddd-dod/types/globals"` at each entry surface only (`apps/api/src/main.ts` + the `bun:test` preload in `bunfig.toml`); the ambient types come from `packages/types/src/globals-types.d.ts` wired via each tsconfig's `include`. Never import the results lib directly outside `@ddd-dod/types`.

### Tests

- **Unit tests co-located** with the source — `foo.ts` → `foo.test.ts` **beside it**, never under `tests/`.
- **Integration / E2E tests** in `tests/` (per package, or `apps/api/tests/` for API E2E). In `platform/`, `tests/` is for cross-module/threaded integration (e.g. worker+DI) and, at most, DB integration.
- **Test fixtures/helpers** (e.g. a worker script a test loads by URL) live in `src/test-helpers/` — never loose in `src/` and never duplicated per test.
- One command: `bun test`. Negative cases required (assert the specific `Err` variant).

## Local dev

```bash
bun install                     # install deps (workspaces)
bun run dev                     # Elysia API (HTTP on PORT, default 3333)
bun test                        # bun:test (unit + integration)
bun run typecheck               # tsc --noEmit across workspaces
bun run lint                    # biome check
bun run check                   # biome check + typecheck
```

## Things to NOT do

- **Do use `Result<T, E>`** — never `throw` in domain/application. Throw is the `ddd-classic` side.
- **Do use free functions for use cases** — deps as parameters, wired at the `apps/api` composition root. No `@Injectable`/`@Inject` decorators (that's the Nest/classic side).
- **Do use the `match(...)` helper** — single branch per use-case flow; no `if (result.isErr())` inside use cases.
- **Do use plain readonly types for entities** — no classes, no private getters, no methods on state.
- **Do use the `(NewState, Events[])` return pattern** — the domain never receives a `publisher`/`bus`/`client`.
- **Do use the transactional Outbox** — not a synchronous EventBus (that's the classic side).
- **Don't put infra in `shared-kernel`** — logger/DI/db/config live in `platform/`; the kernel is pure domain.
- **Don't Zod-parse the own-context read path** — Zod guards external untrusted boundaries only (ADR-0006).
- **Don't edit the shared template playbook** mid-project — apply refinements here; fold back at project close (OQ-001).
- **Don't commit secrets**, **don't bypass Conventional Commits**, **don't reference other projects by hardcoded paths**.

## Per-module AGENTS.md

Each bounded context (`packages/modules/<context>/`) gets its own `AGENTS.md` once it reaches 5+ public items. Template at `docs/ddd-dod/architecture/playbook/agents/module-AGENTS.template.md`. **Read it when you enter the directory.**
