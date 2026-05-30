# AGENTS.md — DDD Classic (project root)

<!--
This is the project-root AGENTS.md template. Fill in the bracketed slots and trim
sections that don't apply to your tier (a prototype doesn't need bounded contexts;
a small project doesn't need outbox guidance). Cross-link to architecture/ docs as
they materialize.

`CLAUDE.md` should be a symlink to this file: `ln -s AGENTS.md CLAUDE.md`. The
same trick works for any other agent that wants its own filename
(`ln -s AGENTS.md .cursorrules`, etc.).
-->

Read this before writing any code. Conventions are normative; deviate only by flagging in chat first.

## What this repo is

<!-- One sentence on what the project is and the broad shape (monorepo? single binary? service + ui?). -->
DDD Classic — <one-line description>. <Stack summary, e.g. "Turborepo + Bun + Cargo workspace" or "single Rust binary" or "Next.js app">.

Canonical architecture docs live under `docs/ddd-classic/architecture/` — kept in sync with the code. If something there is wrong or outdated, flag in chat or open a PR; never let code and docs diverge silently.

## Methodology

This project follows the conventions in `docs/ddd-classic/architecture/playbook/`. Two declarations frame how the workflow operates here — fill them in and revisit when the project grows or shrinks.

- **Tier**: <prototype | small | medium | large> — see playbook §21 (layered application).
- **Feature placement mode**: <A — sprint-bound | B — epic-bound | C — flat> — see playbook §23. Mode A is the default for `small`+ with 3+ contributors; Mode B fits 1–2 contributors running kanban-flow; Mode C is for prototype-tier RPA without epic/sprint apparatus.
- **Sprint planning**: <separate `planning.md` (Mode A, medium+) | section in sprint README (Mode A, small/prototype) | collapsed into the active epic's README (Modes B/C)>.
- **Active artefacts** (check what's currently in use; cross-reference promotion triggers in playbook §22):
  - [ ] `architecture/sdds/` — see promotion trigger (3+ ADRs on a context, etc.)
  - [ ] `architecture/data-model.md` — see promotion trigger (versioned migrations, etc.)
  - [ ] `architecture/threat-model.md` — required if untrusted input or sensitive data
  - [ ] `dev-pipeline/` — required when 3+ contributors edit shared docs

When any promotion trigger fires, log the moment in `open-questions.md` (resolved section) or the active epic's progress log.

### Portability

This methodology is **portable by design** — workflow concepts map 1:1 to mainstream ticketing tools. If you're onboarding from another system, the quick translation is:

| Our concept | Jira | Linear | GitHub Projects |
|---|---|---|---|
| Backlog card | Issue (Backlog) | Issue (Backlog) | Issue + `backlog` label |
| Roadmap card | Issue (Committed) | Issue (Up Next) | Issue in Project |
| Epic | Epic | Project / Initiative | Milestone |
| Sprint | Sprint | Cycle | Iteration |
| `kind` field | Issue Type | Type | Label |
| `exits_with` | Epic checklist | Project completion | Milestone tasks |
| RPA docs / architecture / playbook / AGENTS.md | **stay in git** | **stay in git** | **stay in git** |

Full table, migration effort, and the hybrid (Jira+git) recommendation are in `docs/ddd-classic/architecture/playbook/playbook.md` §24. The TL;DR: workflow can migrate to a ticketing tool in 1–3 days if the project ever outgrows markdown; docs always stay in git.

## Agent-first architecture

This codebase is authored by AI agents collaborating with the human author. The agent's context window is the binding constraint, so:

- **Distinctive, greppable names** (target: <5 hits project-wide for unique identifiers).
- **Small, focused files** (≤ 500 lines, ideally 200–300).
- **Rich doc-comments on domain code** so agents don't have to chase definitions.
- **AGENTS.md at every module/context root** so agents read context before editing.

Read [[docs/ddd-classic/architecture/playbook/playbook.md]] before writing code — it's the long-form version of these rules.

## Priority reading

In order, when starting a session here:

1. This `AGENTS.md` — declarations + project-specific overrides.
2. `docs/ddd-classic/methodology.md` — operating guide (narrative): lifecycle, Day 1 onboarding, Day N feature loop, common recipes, FAQ.
3. `docs/ddd-classic/architecture/playbook/playbook.md` — **single normative playbook** (combina conventions language-agnostic + stack-specific TS + estilo OOP verbose deste projeto). Não há split base/ts neste projeto — playbook único substitui ambos da template.
4. `docs/ddd-classic/architecture/sad.md` (or `srs+sad.md` for prototype tier) — system architecture.
6. `docs/ddd-classic/architecture/srs.md` (medium+) — requirements contract.
7. `docs/ddd-classic/architecture/adrs/` — locked-in decisions; check before deviating.
8. `docs/ddd-classic/architecture/sdds/` (when present) — per-area tactical design.
9. `docs/ddd-classic/epics/` — active epic + `exits_with`.
10. `docs/ddd-classic/sprints/<active-sprint>/features/<active-feature>/` (Mode A) **or** active epic's `features/` (Mode B) — current work card (research → plan → act).

If a decision in an ADR conflicts with what you intend to do, either follow the ADR or flag the discrepancy. Never silently deviate.

## Bounded contexts

<!-- Medium / large only. Delete this section for prototype / small. -->
<!-- List the contexts and their owning crate/package. Example: -->

| # | Context | Role | Owns |
|---|---------|------|------|
| 1 | <name> | <one-line role> | `<path/to/crate-or-package>` |

See `docs/ddd-classic/architecture/sad.md` for context boundaries; `docs/ddd-classic/architecture/sdds/sdd-<context>.md` for the tactical design of each.

## Key directories

| Path | Purpose |
|------|---------|
| <!-- e.g. `apps/<app>` --> | <!-- responsibility --> |
| <!-- e.g. `crates/<context>` --> | <!-- responsibility --> |
| <!-- e.g. `packages/<pkg>` --> | <!-- responsibility --> |
| `docs/ddd-classic/` | Architecture, playbooks, sprint cards. |
| `.github/workflows/` | CI: lint, typecheck, tests on every PR (see playbook §17.4). |

## Conventions

### Code style

<!-- Pin the formatter / linter and any non-default settings. Examples: -->
- **Lint + format**: Biome 2 — `pnpm lint` / `pnpm format:fix`.
- **Indentation**: 2 spaces (TS, JSON, YAML, MD).

### Commits

Conventional Commits per playbook §16.1. Scopes for this repo:

<!-- List the scopes you actually use. Trim until accurate. Examples: -->
`<scope-1>`, `<scope-2>`, `(meta)`, `(docs)`, `(ci)`.

### Branching

Git Flow per playbook §16.2:
- `main` — production. Receives merges from release branches only (after bootstrap).
- `dev` — default working branch.
- Feature work on `feat/<slug>` branches off `dev`. Push, wait for human review, then PR (§16.3).

### Bootstrap-phase exception

Until the `EPIC-001 — bootstrap` epic closes (its `exits_with` all checked), direct commits to `dev` are allowed for scaffolding work. After bootstrap, every feature goes through the §16.3 loop. The `.bootstrap-complete` marker file (or repo tag) signals the transition.

### Errors

<!-- Pin the error pattern for this stack. Examples: -->
- **Rust**: `thiserror` + one enum per module. No `anyhow` in domain/application; only in `main.rs`.
- **TypeScript**: `Result<T, E>` pattern (or whatever the playbook-ts addendum specifies). No throwing for expected control flow.

### Tests

- Unit tests next to the code; integration tests in a top-level `tests/` directory (or `__tests__/`).
- One command per module: `pnpm test` (vitest run, scoped per-context quando suportado).

## Definition of Done

<!--
Trim this checklist to the tier of this project. The blocks below are cumulative —
small includes feature-level; medium includes feature-level + small; etc.
A card is **not** Done until every applicable box is checked.
-->

### Feature-level (every tier)

- [ ] Acceptance criteria in `feature.md` are all checked.
- [ ] `act.md` written (at minimum: what shipped, what got punted, surprises).
- [ ] Code merged into `dev` via PR squash-merge, after the human-validation pause (playbook §16.3).
- [ ] CI green: format + lint + typecheck + tests (playbook §17.4).
- [ ] No `TODO`/`FIXME` left without a matching entry in `open-questions.md` or an issue.

### Additional for `small`+

- [ ] Module `AGENTS.md` updated if the public surface changed.
- [ ] Tests cover happy path and at least one negative case (per playbook §10.5).

### Additional for `medium`+

- [ ] ADR written if a non-trivial lock-in decision was made (playbook §18).
- [ ] SDD updated if invariants or operations of a bounded context changed.
- [ ] Doc-comments on new public items carry provenance (invariants, emitted events, consumers, ADR link — see playbook §12).

### Additional for `large`

- [ ] Redlines under `docs/ddd-classic/dev-pipeline/redlines/` opened for non-trivial doc changes (SAD/SRS/data-model).
- [ ] Threat-model revisited if user-facing input shape changed.
- [ ] Migrations rehearsed against a production-like dataset.

### Epic-level (when this card closes an epic)

- [ ] All `exits_with` items in the epic file are checked.
- [ ] Epic moved to **Done** on the epics kanban.
- [ ] Release performed per playbook §16.4 (`dev → main`, tag, `CHANGELOG.md` entry).

## Local dev

```bash
# Initial setup (run once after clone)
pnpm install
# cp .env.example .env  (se houver vars)

# Day-to-day
pnpm dev                        # nest start --watch (HTTP em :3000)
pnpm test                       # vitest run (unit + e2e in-process)
pnpm typecheck                  # tsc --noEmit
pnpm lint                       # biome check
pnpm check                      # biome check + typecheck
pnpm build && pnpm start:prod   # build + run dist/main
```

## Skills

<!-- List any custom Claude Code skills under `.claude/skills/`. Delete the
section if there are none. -->

- `.claude/skills/<skill-name>/` — <one-line purpose>.

## Things to NOT do

<!-- Anti-patterns specific to this repo. Add as the project teaches you. Examples: -->

- **Don't commit secrets.** `.env` is git-ignored; keep `.env.example` in sync when new vars are added.
- **Don't bypass Conventional Commits.**
- **Don't reference other projects** by hardcoded paths. If cross-project context matters, document it explicitly.
- **Don't mix domain and infra concerns** in the same module.

## Per-module AGENTS.md

Each `<crate>/`, `<package>/`, or `<app>/` has its own `AGENTS.md` with surface-specific conventions, commands, and points of attention. **Read it when you enter the directory.** A template lives at `docs/ddd-classic/architecture/playbook/agents/module-AGENTS.template.md`.
