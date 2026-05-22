# AGENTS.md — Dod Vs Oop Classic (project root)

Read this before writing any code. Conventions are normative; deviate only by flagging in chat first.

## What this repo is

**Dod Vs Oop Classic** — **verbose-canonical OOP foil** of the comparative study [DOD + DDD + Small Clean Arch](../README.md). Single NestJS application (Express adapter) + TypeORM + better-sqlite3 (`:memory:`). Implements the **double-entry financial Ledger** domain (Account, Posting, Transaction, Statement, Reconciliation) in Evans/Vernon style — rich AggregateRoot with 300+ lines, `create()` / `buildExisting()` factories, classed validators per entity, **throw on first violation** (does NOT use `Result`), bidirectional mappers, repository segregated per operation, in-memory EventBus with no Outbox.

Mirrors the real production style of `a real-world production ledger system`, derived from the DDD core template at `~/Dev/projects/ddd-templates`.

Canonical architecture docs live under `docs/dod-vs-oop-classic/architecture/` — kept in sync with the code. If something there is wrong or outdated, flag in chat or open a PR; never let code and docs diverge silently.

## Methodology

This project follows the conventions in `docs/dod-vs-oop-classic/architecture/playbook/`. **Important override**: because this is the study's OOP foil, the template's `playbook-base.md` and `playbook-ts.md` were **replaced by a single `playbook.md`** that codifies the verbose-canonical style (throw-based, mappers, segregated repos, no Outbox). The sibling `dod-vs-oop-dod/` uses the template's original playbooks.

- **Tier**: medium — see playbook §21 (layered application).
- **Feature placement mode**: B — epic-bound — see playbook §23. 1 contributor (kanban-flow).
- **Sprint planning**: collapsed into the active epic's README (Mode B).
- **Active artefacts** (check what's currently in use; cross-reference promotion triggers in playbook §22):
  - [x] `architecture/sdds/` — in use since FEAT-001 (`sdd-accounts.md`); trigger fired (5+ public items in `accounts`).
  - [ ] `architecture/data-model.md` — promotion trigger: versioned migrations, etc.
  - [ ] `architecture/threat-model.md` — N/A (didactic study, no sensitive data)
  - [ ] `dev-pipeline/` — N/A (large tier only)

When any promotion trigger fires, log the moment in `open-questions.md` (resolved section) or the active epic's progress log.

## Agent-first architecture

This codebase is authored by AI agents collaborating with the human author. The agent's context window is the binding constraint, so:

- **Distinctive, greppable names** (target: <5 hits project-wide for unique identifiers).
- **Small, focused files** (≤ 500 lines, ideally 200–300). Note: AggregateRoot/Validator pairs may reach 300–400 lines — deliberate, reflecting the verbose-canonical style.
- **Rich doc-comments on domain code** so agents don't have to chase definitions.
- **AGENTS.md at every module/context root** so agents read context before editing.

Read [[docs/dod-vs-oop-classic/architecture/playbook/playbook.md]] before writing code — it's the long-form version of these rules plus the verbose-canonical DDD patterns specific to this project.

## Priority reading

In order, when starting a session here:

1. This `AGENTS.md` — declarations + project-specific overrides.
2. `docs/dod-vs-oop-classic/methodology.md` — operating guide (narrative): lifecycle, Day 1 onboarding, Day N feature loop, common recipes, FAQ.
3. `docs/dod-vs-oop-classic/architecture/playbook/playbook.md` — **single normative playbook** (combines language-agnostic + TS-specific + verbose-canonical OOP style for this project). No base/ts split here.
4. `docs/dod-vs-oop-classic/architecture/sad.md` — system architecture.
5. `docs/dod-vs-oop-classic/architecture/srs.md` — requirements contract.
6. `docs/dod-vs-oop-classic/architecture/adrs/` — locked-in decisions; check before deviating.
7. `docs/dod-vs-oop-classic/architecture/sdds/` (when present) — per-area tactical design.
8. `docs/dod-vs-oop-classic/epics/` — active epic + `exits_with` + Mode B features (`epics/<id>/features/<id>/`).
9. `../README.md` (`examples/` root) — public overview of the study.
10. `../../PLAN.md` (`studies/dod/` root) — internal source of truth for the study.

If a decision in an ADR conflicts with what you intend to do, either follow the ADR or flag the discrepancy. Never silently deviate.

## Bounded contexts

| # | Context | Role | Owns |
|---|---------|------|------|
| 1 | `ledger` | Core: postings + double-entry transactions | `src/ledger/` |
| 2 | `accounts` | Aggregate balance, holds, status (lifecycle) | `src/accounts/` |
| 3 | `statements` | Statement generation (CPU-bound #1) | `src/statements/` |
| 4 | `reconciliation` | External × internal matching (CPU-bound #2) | `src/reconciliation/` |

See `docs/dod-vs-oop-classic/architecture/sad.md` for context boundaries; `docs/dod-vs-oop-classic/architecture/sdds/sdd-<context>.md` for the tactical design of each (once promoted).

## Key directories

| Path | Purpose |
|------|---------|
| `src/core/` | DDD building blocks (Entity, AggregateRoot, ValueObject, Validator) — copied from `~/Dev/projects/ddd-templates/core/` with **throw-based overrides** (no `Result`) |
| `src/shared/` | Cross-context VOs (Identifier, Money) + synchronous in-memory EventBus |
| `src/<context>/` | Bounded context: `domain/` + `application/` + `infrastructure/` (TypeORM + HTTP controllers) |
| `tests/` | Integration / E2E tests via NestJS testing (in-process app boot + supertest), at `src/` level |
| `docs/dod-vs-oop-classic/` | Architecture, playbook, sprint cards, methodology |
| `.github/workflows/` | CI: lint, typecheck, tests on every PR (playbook §17.4) |

## Conventions

### Code style

- **Lint + format**: Biome 2 — `pnpm lint` / `pnpm format:fix`.
- **Indentation**: 2 spaces (TS, JSON, YAML, MD).
- **TypeScript strictest**: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`.

### Commits

Conventional Commits per playbook §16.1. Scopes for this repo:

`core`, `shared`, `ledger`, `accounts`, `statements`, `reconciliation`, `(meta)`, `(docs)`, `(ci)`.

### Branching

Git Flow per playbook §16.2:
- `main` — production. Receives merges from release branches only (after bootstrap).
- `dev` — default working branch.
- Feature work on `feat/<slug>` branches off `dev`. Push, wait for human review, then PR (§16.3).

### Bootstrap-phase exception

Until the `EPIC-001 — bootstrap` epic closes (its `exits_with` all checked), direct commits to `dev` are allowed for scaffolding work. After bootstrap, every feature goes through the §16.3 loop.

### Errors

**Throw on first violation** (override for this project's verbose-canonical OOP style — faithful to `the production reference`):
- Validators accumulate errors in a stack via `addError()`
- Entity/VO constructors invoke `validator.validate()`, which **throws** `InvalidEntityError` / `InvalidValueObjectError` / `InvalidIdentifierError` on the first invalid instantiation
- Use cases return `Promise<TResponse>` directly; errors propagate as exceptions
- NestJS HTTP exception filter converts them to 4xx/5xx responses
- **Do NOT use `Result<T, E>`** — that's the DOD side (`dod-vs-oop-dod/`)

### Tests

- **Unit tests co-located** with the source — `money.ts` lives next to `money.spec.ts` in the same directory. No `__tests__/` subdir.
- **Integration / E2E tests** in `tests/` at the `src/` level — `tests/<context>/<feature>.e2e.spec.ts` (via NestJS in-process testing).
- One command: `pnpm test`. Negative cases are required (`expect(() => x).toThrow(InvalidEntityError)`).

## Definition of Done

### Feature-level (every tier)

- [ ] Acceptance criteria in `feature.md` are all checked.
- [ ] `act.md` written (at minimum: what shipped, what got punted, surprises).
- [ ] Code merged into `dev` via PR squash-merge, after the human-validation pause (playbook §16.3).
- [ ] CI green: format + lint + typecheck + tests (playbook §17.4).
- [ ] No `TODO`/`FIXME` left without a matching entry in `open-questions.md` or an issue.

### Additional for `small`+

- [ ] Module `AGENTS.md` updated if the public surface changed.
- [ ] Tests cover happy path and at least one negative case.

### Additional for `medium`+

- [ ] ADR written if a non-trivial lock-in decision was made.
- [ ] SDD updated if invariants or operations of a bounded context changed.
- [ ] Doc-comments on new public items carry provenance (invariants, emitted events, consumers, ADR link).

### Epic-level (when this card closes an epic)

- [ ] All `exits_with` items in the epic file are checked.
- [ ] Epic moved to **Done** on the epics kanban.
- [ ] Release performed per playbook §16.4 (`dev → main`, tag, `CHANGELOG.md` entry).

## Local dev

```bash
# Initial setup (run once after clone)
pnpm install

# Day-to-day
pnpm dev                        # nest start --watch (HTTP on :3000)
pnpm test                       # vitest run (unit + e2e in-process)
pnpm test:watch                 # vitest watch
pnpm typecheck                  # tsc --noEmit
pnpm lint                       # biome check
pnpm check                      # biome check + typecheck
pnpm build && pnpm start:prod   # build + run dist/main
```

## Things to NOT do

- **Do not use `Result<T, E>`** — this project is deliberately throw-based. `Result` is the DOD side.
- **Do not use free functions for use cases** — use classes. But keep them **framework-free** (ADR-0005): the constructor takes ports; NestJS tokens + providers live in `infrastructure/provider/`, not on the use case (`@Injectable`/`@Inject` belong to infra only).
- **Do not use generic `Repository<T>`** — use interfaces segregated per operation (CQRS-style).
- **Do not use Outbox** — use the synchronous in-memory EventBus. Outbox is the DOD side.
- **Do not use the `match(...)` helper** — use `try/catch` or let exceptions propagate.
- **Do not use plain types for entities** — use classes with private getters.
- **Do not use the `(NewState, Events[])` return pattern** — use internal `this.addDomainEvent()`.
- **Do not use immutable spread for state** — use controlled mutation via methods.
- **Don't commit secrets**, **don't bypass Conventional Commits**, **don't reference other projects by hardcoded paths** (this project derives from the DDD core template and from `the production reference` — references are documented in the README/playbook).

## Per-module AGENTS.md

Each bounded context (`src/<context>/`) gets its own `AGENTS.md` once it reaches 5+ public items. Template at `docs/dod-vs-oop-classic/architecture/playbook/agents/module-AGENTS.template.md`. **Read it when you enter the directory.**
