# Playbook (Base)

Language-agnostic conventions every contributor — human or AI agent — must follow. Pair with a language addendum (`playbook-rust.md`, `playbook-ts.md`) for code examples and stack-specific rules.

This document is normative. If you disagree with a rule, raise an ADR before deviating.

## 1. Why this playbook exists

Two pressures shape every rule below:

- **Code is written and read by AI agents alongside the human author.** The agent's context window is the binding constraint. Distinctive names and small files are operational, not stylistic.
- **Consistency reduces re-discovery.** Every session that has to relearn "how do we structure errors here" loses time and risks drift. Lints, types, and a written playbook keep the discipline anchored.

## 2. Why not canonical Clean Architecture

We keep the **spirit** of Clean Architecture (dependency inversion where it matters, domain isolation, testable use cases) and drop the **ceremony** (one interface per operation, DTO-per-layer, mapper classes, `*UseCase` structs).

Specifically:

- Use cases are **free functions**, not classes.
- The **module boundary** is the layer boundary. Inside one module/crate we don't need a `domain/` + `application/` + `infrastructure/` triplet unless the module is large enough to warrant it.
- Repositories appear when there's an external store to abstract. A repository is **per aggregate**, not per query (Fowler, *Patterns of Enterprise Application Architecture*).
- Dependencies are passed as `&impl Trait` parameters to the function that needs them. They are never stored on a struct just to obey "constructor injection".

When you find yourself writing `class DoXUseCase { repo: Repo; execute() }`, stop. Write `do_x(input, repo) -> Result<...>` instead.

### 6.1 Behavioral routes — the API is a vocabulary of domain intentions

When a context exposes an HTTP/gRPC surface, **routes expose the use-case / intent, not a state patch**. The route names a behavior the domain understands; the use case behind it enforces the invariants.

```
POST /appointments/:id/confirm        ✓  names the intent; maps to confirm_appointment(...)
POST /appointments/:id/cancel         ✓
PATCH /appointments/:id  {status:"confirmed"}   ✗  leaks state, bypasses the use case, invites invalid transitions
```

Why: a `status` patch lets any caller drive the aggregate into any state, so the transition rules end up scattered across callers (or nowhere). A behavioral route has exactly one entry point — the use case — where the invariant lives. This keeps REST (resources are still nouns: `/appointments/:id`) while the **action** is an intent verb, not a field write. Document the route → use-case → aggregate mapping in the SDD's behavioral-API-surface table (and, at medium+, in each FRD's).

## 3. Core conventions (summary)

| # | Convention |
|---|------------|
| 1 | Files ≤ 500 lines, ideally 200–300 |
| 2 | Functions 4–60 lines, single responsibility |
| 3 | One repository trait per aggregate (Fowler PoEAA), not per method |
| 4 | Use case = free function with dependencies passed as parameters (no constructor injection). A *functional, Result-native* DI container may wire deps at the **composition root only** — use cases stay container-agnostic (never receive the container) |
| 5 | Distinctive, greppable names (target: <5 hits project-wide for unique identifiers) |
| 6 | Rich doc-comments on aggregates, use cases, events, ports |
| 7 | Explicit types — no escape hatches (`any`, untyped JSON); newtypes for IDs and other semantically-loaded values |
| 8 | DRY only after the third occurrence; two is a coincidence |
| 9 | Errors with the offending value + the expected shape |
| 10 | No process-aborting calls in production code (panics, unhandled throws); reserve them for tests |
| 11 | Tests use `?` propagation; setup errors fail fast through error chain |
| 12 | Early returns; max 2 indentation levels in any function |
| 13 | Default formatter, no bikeshedding |
| 14 | Structured JSON logs (per the chosen logger) |
| 15 | `AGENTS.md` at every bounded context root (and the repo root) |

The next sections expand each rule.

## 4. Size table

| Unit | Soft limit | Hard limit | What to do at the limit |
|------|------------|------------|--------------------------|
| File (LOC including tests) | 300 | 500 | Split by sub-responsibility. |
| Function | 50 | 100 | Extract helper functions. |
| Match arm body | 5 | 15 | Extract a function. Keep `match` legible. |
| Indentation depth | 2 | 3 | Use early returns; flatten nested conditions. |
| Public items per crate / package | — | — | If the public re-exports list passes ~30 items, the unit is doing too much. |

These are guidelines, not laws — but the team-wide ratio of "files at hard limit" should be near zero. If it isn't, the codebase is drifting.

## 5. Module organization

A project is a workspace of modules. Each module has a focused responsibility. **The module boundary is the strongest abstraction the language gives you — use it.**

Two scales:

### 5.1 Crate / package = bounded context

For DDD-shaped projects (medium / large tiers), each top-level module is a **bounded context**:

- Owns its aggregate roots, value objects, domain events, repository trait.
- Exposes a public API via the module's index/lib file. Internal items are not reachable from sibling contexts.
- Cross-context communication goes via **published events** (re-exported from the context's public surface). No reaching into private modules.

### 5.2 Files inside a context

Inside one context, files are small modules with focused responsibility. A typical context has:

- One file per **aggregate root** (with rich doc-comments — see §10).
- One file per **value object** if it has its own logic.
- A file for **domain events** (the public contract for cross-context comms).
- A file for **errors** (or an `error.rs`/`errors.ts`).
- A file per **use case** (one function per file in DDD-shaped contexts; less strict in lighter projects).
- Adapters in their own subfolder (`infra/`, `adapters/`, `repositories/`).

In small / prototype tiers, this collapses into a flat module without the formal `domain/application/infrastructure` split. Promote the structure when the context grows past ~5 files.

## 6. Use cases as free functions

```
do_x(input, repo: &impl Repository, other: &impl OtherDep) -> Result<Output, Error>
```

Rules:

1. **One file, one function.** No `class DoXUseCase { execute() }`.
2. **Dependencies as parameters**, not stored on a struct. The use case is testable by passing fakes.
3. **The use case is the orchestrator**: it calls the aggregate (which validates invariants and emits events) and the repository (which persists). It does not know about HTTP / CLI / UI.
4. **Tracing instrumentation** at the use case boundary (per the language's tracing convention).

For projects with **outbox pattern** (large tier, billing-critical flows): the use case never injects an `EventPublisher`. Publishing is infra; the outbox poller publishes asynchronously after the repository's atomic save-with-events.

## 7. Repository pattern

One repository trait per **aggregate** (Fowler PoEAA), with operations the use cases need:

- `find_by_id(id) -> Option<Aggregate>`
- `save(aggregate) -> Result<()>`
- `save_with_events(aggregate, events) -> Result<()>` (when using outbox)

**Not** one repository per method. **Not** one repository per query. The aggregate is the unit of consistency; the repository is the boundary between the aggregate and the storage layer.

For tiny projects without an external store, the "repository" might just be `&mut Vec<Aggregate>`. Fine — promote when persistence shows up.

## 8. Domain events (when applicable)

When a project has multiple bounded contexts that need to react to each other, **domain events** are the cross-context channel.

Rules:

- Events are **public contracts** between contexts. Shape changes are breaking changes for every subscriber.
- **Never mutate a published event shape.** Deprecate the old name and publish a new one (`x.created.v2`).
- Events live in a single file per context (`events.rs` / `events.ts`), serializable, with a stable `name()` method (`<context>.<verb_past_participle>`).
- Subscribers in another context import the **published event types only** — never reach into the source context's domain.

For projects that don't need cross-context comms, skip events entirely. Don't introduce them just to follow a pattern.

## 9. Outbox pattern (large tier, billing-critical only)

When event loss is unacceptable (billing, audit, compliance), use the **transactional outbox**:

1. Use case calls `repo.save_with_events(aggregate, events)`.
2. The repository **atomically** persists the aggregate state AND inserts event rows into an `outbox` table — same transaction.
3. A **poller** reads new outbox rows, publishes to the bus / next-context handler, and marks them processed (also atomically).
4. If the transaction rolls back, no event is published.

When NOT to use outbox: best-effort flows (analytics, internal logging). Document the choice in the SAD ("events are best-effort here") so the next reader knows.

## 10. Errors

The most important section.

### 10.1 Typed errors per module / crate

Every module exposes its own `Error` enum and a `Result<T>` typedef. The error variants name the failure modes the module can produce.

### 10.2 No process-wide "anyhow-style" boxing in production code

A binary that composes multiple modules defines its own typed `Error` with `#[from]` (Rust) / `extends` (TS) for each child error. Pattern matching on errors in the top-level handler enables targeted user remediation.

Avoid `Box<dyn Error>` in non-test public APIs. It defeats pattern matching.

### 10.3 Errors carry the offending value and expected shape

Bad:
```
"invalid score"
```

Good:
```
"invalid ats score: 142 (expected 0..=100)"
```

The receiver of `Display::fmt` should know how to fix the problem without reading the code that produced it.

### 10.4 No `unwrap()` / `expect()` / `panic!()` in non-test code

If you find yourself wanting `.unwrap()`, the answer is `?`. If you can't `?`, the function should return `Result`. Lints enforce this; CI fails on warnings.

### 10.5 Tests use `?` propagation

Setup errors (creating a tempdir, parsing a fixture, writing a file) propagate via `?` instead of `.expect("setup failed")`. The test framework prints the error chain on failure.

Negative tests assert the specific error variant, not just "any error":

```
assert!(matches!(result, Err(Error::Variant { .. })));
```

### 10.6 Display vs structured rendering — two jobs, two renderers

An error usually needs **two** renderings, and they must not be confused:

- **Display** — human-readable, one line, for boot/CLI logs and developer eyes. This is §10.3 (`Display::fmt` in Rust; a `format(e) -> string` in TS). It is **never** an API response body or a machine log field.
- **Structured** — a flat, serializable record (`{ kind, …safe fields }`) for **observability** (log/metric/trace fields, queryable) and as the source for an API mapping. Stringifying the Display blob into a log or an HTTP body is the anti-pattern: it can't be queried and leaks human phrasing into a machine contract.

Bundle both with the error (in TS, a `defineError`-style helper that *requires* `format` + `serialize` — see `playbook-ts` §5; in Rust, `Display` + `serde::Serialize`). Keep the structured type **validator/logger-neutral** so a pure-domain error depends on neither. Mapping a variant → transport response (HTTP status + stable token + safe fields) is a **boundary** concern done at the handler, not a third renderer baked into the error.

## 11. Strict typing

- **Newtype wrappers** for IDs, paths, and short strings with semantics. Pass `ProjectHash`, not `String`.
- **Enums for closed sets.** `Severity { Info, Warn, High }`, not stringly-typed `severity: string`.
- **`Option<T>` over sentinel values.** Never `0` or `-1` to mean "missing".
- **Reject unknown fields at parse time** in every public deserialised struct (`#[serde(deny_unknown_fields)]` in Rust, `.strict()` in Zod). Typos must fail loudly.

## 12. Doc comments and provenance

- **Comments only when WHY is non-obvious.** Names carry the WHAT.
- **Doc comments are required on every public item in domain modules.** Optional in adapters, encouraged for non-trivial APIs.
- **Provenance format** for non-trivial public items:
  ```
  /// Brief summary.
  ///
  /// # Inputs
  /// # Errors
  /// # Invariants
  /// # Emitted events (DDD)
  /// # Consumers (DDD)
  ///
  /// See ADR-NNNN.
  ```
- **Never strip provenance.** A comment that links to an ADR or names an invariant is part of the contract. Refactors must carry it forward.
- **Never leave `TODO` / `FIXME` without an associated `open-questions.md` entry or issue.**

## 13. Naming

- **Distinctive and greppable.** Unique identifiers should produce <5 hits project-wide.
- **Generic types are bad neighbours.** `Project`, `Profile`, `Config` are too plain — qualify with the crate prefix in cross-module references.
- **Types are nouns. Functions are verbs. Booleans read as predicates** (`is_running`, `should_block`, `has_compose`).

## 14. Logging

- **Structured logs everywhere.** Never log freeform strings for diagnostics; reserve stdout for user-facing CLI output.
- **Spans on every command and every adapter call.** Top-level entry opens a span; everything inside is a child event.
- **Fields, not strings.** `info(project = hash, lang = lang, "starting")`, not `info("starting " + hash + " " + lang)`.
- **Levels:**
  - `error` — failure that aborts the operation
  - `warn` — degraded but proceeding
  - `info` — high-level milestone visible to a normal user with `--verbose`
  - `debug` — per-step detail for the maintainer
  - `trace` — verbose, off by default

## 15. Testing

- **Unit tests live next to the code.** Integration tests in a top-level `tests/` directory.
- **Tests return a Result type** and use `?` for setup (per §10.5).
- **No mocking external dependencies by hand.** Use named fakes living under a `testing/` (or feature-gated) module — reusable across crates.
- **Property tests** are appropriate for parsers and schema validators.
- **One command per module.** `cargo test -p <crate>` / `bun test packages/<pkg>` should always run that module's tests headless without setup.

## 16. Commits and branches

### 16.1 Conventional Commits

Scope is the affected module/crate/package name:

```
feat(billing): add credit deduction use case
fix(scheduler): handle stopped container in start command
docs(adr): accept ADR-NNNN
refactor(core): extract Project::resolve into a separate file
test(scan): add fixtures for compose validation
chore: bump tokio to 1.x
```

Multi-line commit messages preferred when the change has any subtlety. The body explains *why*; the diff explains *what*.

### 16.2 Git Flow

- `main` is release-tagged, deployable, and always builds. After bootstrap it only receives merges from release branches (or hotfix branches in emergencies).
- `dev` is the **default working branch** and the integration target. Day-to-day work targets `dev`.
- Feature work happens on `feat/<name>` branches off `dev` and **squash-merges** back into `dev` via PR.
- Release branches off `dev` merge into `main` (tagged) and back into `dev`.

For the bootstrap-time setup of these branches and their hooks/CI, see §17.

### 16.3 Per-feature workflow (post-bootstrap)

Once the bootstrap window closes (§17.2), every feature follows this loop. **The agent does not skip steps; the human gates the PR.**

1. Sync and branch: `git checkout dev && git pull && git checkout -b feat/<name>`.
2. Implement, commit (Conventional Commits per §16.1). Multiple small commits are fine — they will squash on merge.
3. Push the branch: `git push -u origin feat/<name>`. **Do not open the PR yet.**
4. **Pause for human validation.** The human pulls the branch locally, reviews code + docs (sprint card RPA, ADRs, AGENTS.md updates), runs the feature, and either requests changes or approves.
5. Once validated, open the PR: `gh pr create --base dev --title "feat(<scope>): ..." --body "..."`.
6. CI must pass green (§17.4). Address review comments; do not force-push without coordinating.
7. Squash-merge to `dev`.
8. Release to `main` is triggered when an epic closes, not on a calendar — see §16.4.

The push-before-PR step is intentional: it gives the human a real branch to inspect before any GitHub state (PR comments, reviewers, CI minutes) is created.

### 16.4 Release on epic close

Releases (`dev → main` merges with a tag) are **triggered by epic closure**, not by sprint boundaries or a calendar.

When an epic moves to `status: done` (all `exits_with` items checked — see `../epics/`):

1. Verify CI is green on the `dev` HEAD.
2. Verify the epic's `exits_with` items are all checked in `../epics/<id>-<slug>.md`.
3. Update `CHANGELOG.md` at the repo root with one entry per epic close (auto-generated from squash-merge messages on `dev` since the last tag is fine; manual edits to clarify are encouraged).
4. Merge to `main` and tag:

   ```sh
   git checkout main && git pull
   git merge --no-ff dev -m "release: EPIC-<id> <slug>"
   git tag -a v<X>.<Y>.<Z> -m "EPIC-<id>: <slug>"
   git push origin main --tags
   ```

5. Optionally fast-forward `dev` back to `main` to keep the histories aligned (`git checkout dev && git merge main && git push`).

**Semver bumps**:

- The scaffolding epic to close (`EPIC-001 — bootstrap`, `type: infra`) ships `v0.1.0`.
- Subsequent **capability** epics bump the minor (`v0.2.0`, `v0.3.0`, …) while the project is pre-1.0.
- **Refactor / infra** epics that don't change a public surface bump the patch.
- First production release is `v1.0.0` — a deliberate product decision, not automatic.
- Post-1.0: capability with breaking surface changes bumps major; additive changes bump minor; refactor/infra/bugfix bumps patch.

**Hotfix exception**: a production-blocking bug fix may go directly to `main` via a `hotfix/<slug>` branch (off `main`), tagged as a patch release. The fix is then cherry-picked back to `dev` and any in-flight `feat/` branches rebased.

**Tier applicability**: required at `small+`. At `prototype`, releases can stay informal until the project graduates — but `bootstrap` closing is still a natural moment to cut a `v0.1.0` tag.

## 17. Project bootstrap

The first sprint or two of a new project are pure scaffolding: monorepo layout, base dependencies, framework setup, CI, repo configuration. **No domain code yet.** Different rules apply during this window.

### 17.1 Git initialization (default)

A new project is `git init`'d as the first action of bootstrap, unless the user explicitly opts out.

**Branch creation:**

```sh
git init
# scaffold + first commit
git add . && git commit -m "chore: initial scaffold"   # lands on main
git checkout -b dev                                     # branch dev off main
# day-to-day work continues on dev
```

**First push to remote** (after `git remote add origin <url>`):

```sh
git push -u origin dev      # push dev first; it becomes the working branch on the remote
git push origin main        # then push main
```

`dev` is pushed first so the remote default tracks the working branch. `main` is the production target and stays empty of feature work after this initial push.

### 17.2 Bootstrap-phase exception

During the **bootstrap window** — while the `EPIC-001 — bootstrap` epic (`type: infra`) is still open and **no domain logic exists yet** (the first one or two sprints) — contributors may:

- **Commit directly to `dev`** (no feature branch needed for "install React, set up tsconfig, add eslint config").
- **Merge `dev` → `main` without a PR** when the scaffold reaches a clean checkpoint.

Why: gating every scaffolding commit through the §16.3 review loop creates pure ceremony when the work has no domain decisions to review. The exception ends the moment the bootstrap epic moves to `status: done` (its `exits_with` are all checked) — typically when the first feature card with domain logic is about to move to `InProgress`. From then on, §16.3 applies — including for further infra/scaffolding work.

The user is the source of truth for "bootstrap complete". The agent should ask if unsure.

### 17.3 Commit hooks (installed during bootstrap)

The bootstrap commits include hooks that enforce the §16.3 flow once bootstrap closes:

- `pre-commit` — refuse direct commits to `dev` if the project is past bootstrap (toggle via a `.bootstrap-complete` marker file at repo root, or a tag).
- `pre-push` — refuse pushes to `main` from any branch other than a release branch.

Tooling per stack:

- **Node/TS projects:** [husky](https://typicode.github.io/husky/). `bun add -d husky && bunx husky init`. Add the scripts under `.husky/`.
- **Rust projects:** [cargo-husky](https://github.com/rhysd/cargo-husky) as a `[dev-dependencies]` entry, or a plain shell script under `scripts/git-hooks/` installed by a Makefile/justfile target.
- **Polyglot:** keep both, scoped per workspace.

The hook scripts themselves are short (a few lines of shell). Commit them; do not rely on global git config.

### 17.4 CI/CD (installed during bootstrap)

Bootstrap commits also include `.github/workflows/`. Ready-to-use workflows live in `methodology/_shared/github-workflows/` of the project_templates repo:

- `rust-ci.yml` — `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test --workspace`. Triggers on PRs targeting `main`/`dev` and on direct pushes to those branches.
- `lint-and-typecheck-ts.yml` — `bun run lint` (Biome), `bun run typecheck`, `bun test`. Same triggers.

Pick the workflow(s) for the chosen `ts`, copy them into the new project's `.github/workflows/`, and commit in the bootstrap window. **Every PR opened after bootstrap must run these workflows green before merge.**

Branch protection on `main` (and on `dev` after bootstrap) should require the relevant CI to pass — configured in the GitHub repo settings, not in code, but documented in the project's `dev-pipeline/README.md` (large tier) or `sad.md` "Operational concerns" section.

For projects beyond bootstrap, additional workflows can be added (smoke tests, e2e, deploy). Keep them under `.github/workflows/`.

## 18. ADRs

Required when:

- Changing a default that affects security posture or data integrity.
- Adding a new external dependency (a library that pulls non-trivial transitive deps, or a new system-level requirement).
- Changing a public surface (API endpoint, CLI subcommand, schema column).
- Choosing between two approaches with lasting trade-offs the next contributor would need to understand.

Format: `adrs/NNNN-title.md`. Use the Templater snippet (`.obsidian/templates/adr-template.md`).

Status starts as `Draft`, moves to `Accepted` when the corresponding code lands.

## 19. AGENTS.md

Every module / crate / app has its own `AGENTS.md` describing:

- **Responsibility** — one sentence on what this owns.
- **Boundaries** — what it does *not* own; what depends on it; what it depends on.
- **Layout** — file tree summary.
- **Conventions specific to this module** — overrides or refinements of this playbook.
- **Commands** — `cargo test -p X`, `bun test packages/X`, etc.
- **Points of attention** — invariants, ADR links, gotchas.

The repo-root `AGENTS.md` points at the priority-reading chain (threat-model, srs, sad, playbook, roadmap) and at each module's `AGENTS.md`.

## 20. Things to NOT do

1. **Don't shell out via string.** Build commands programmatically.
2. **Don't introduce wide permissions** (privileged mode, world-writable files, host network) without an explicit user opt-in path.
3. **Don't write to source from inside a sandboxed container** in default mode.
4. **Don't hardcode language / config detection** if a manifest can express it.
5. **Don't bypass guardrails silently.** A flag like `--unsafe` is the explicit override; silent skipping is a footgun.
6. **Don't `.clone()` to placate the borrow checker.** Refactor.
7. **Don't write integration tests that assume specific host UID/GID** or other ambient state.
8. **Don't hide debugging affordances.** Every action must be representable as a printable command (`--print-cmd`) or trace span.
9. **Don't catch panics to recover.** A panic is a bug — let it abort and surface in logs.
10. **Don't introduce DDD ceremony before you have multiple bounded contexts.** Premature layering is the same disease as premature abstraction.

## 21. Layered application

Some rules apply universally; some only to certain tiers. Quick reference:

| Section | prototype | small | medium | large |
|---------|:-:|:-:|:-:|:-:|
| 4 (size table) | ✓ | ✓ | ✓ | ✓ |
| 5.1 (bounded context = crate) | — | optional | ✓ | ✓ |
| 6 (use cases as functions) | ✓ | ✓ | ✓ | ✓ |
| 7 (repository per aggregate) | optional | ✓ | ✓ | ✓ |
| 8 (domain events) | — | optional | ✓ | ✓ |
| 9 (outbox) | — | — | when needed | ✓ |
| 10 (errors) | ✓ | ✓ | ✓ | ✓ |
| 12 (doc comments / provenance) | ✓ | ✓ | ✓ | ✓ |
| 14 (structured logging) | ✓ | ✓ | ✓ | ✓ |
| 15 (named test fakes) | inline ok | ✓ | ✓ | ✓ |
| 16.3 (per-feature workflow) | ✓ | ✓ | ✓ | ✓ |
| 16.4 (release on epic close) | optional | ✓ | ✓ | ✓ |
| 17.1 (git init + dev/main) | ✓ | ✓ | ✓ | ✓ |
| 17.3 (commit hooks) | optional | ✓ | ✓ | ✓ |
| 17.4 (CI workflows) | optional | ✓ | ✓ | ✓ |
| 18 (ADRs) | ✓ | ✓ | ✓ | ✓ |
| 19 (AGENTS.md per crate) | root only | per crate | per crate | per crate + per app |
| Epics directory | optional (flat `epics.md`) | ✓ (kanban) | ✓ (kanban) | ✓ (kanban + per-epic folder) |
| Epic `type` field (capability/refactor/infra; temporal grouping is a Milestone, not a type) | optional | ✓ | ✓ | ✓ |
| Epic `exits_with` criteria | optional | recommended | ✓ | ✓ |
| SDD (one bounded context = one SDD; an Epic *references* it via `sdd:`) | absorbed in `srs+sad.md` | flat file `sdds/sdd-<slug>.md` | ✓ flat file | ✓ flat file |
| FRD layer (`architecture/frds/frd-<slug>.md`, 1:1 with a Feature) | absorbed in `srs+sad.md` | absorbed in the SDD ("Functionalities" section) | ✓ split out (flat file) | ✓ split out (flat file) |
| Card `kind` field (feature/refactor/infra/bug) | recommended | ✓ | ✓ | ✓ |
| Sprint planning artifact | section in README | section in README | `planning.md` separate | `planning.md` + capacity history |
| Definition of Done (root AGENTS.md) | minimal (5 items) | basic (8 items) | full (10 items) | full + governance refs |

The table above is the **tier axis**. There are two more axes that scale orthogonally to it:

- **§22 — Promotion triggers**: when an "optional" artefact becomes required, decided by an observable signal rather than tier.
- **§23 — Feature placement modes**: where features physically live (under sprints, under epics, or flat).

## 22. Promotion triggers

Some artefacts are marked "optional" at a tier but become non-negotiable once a concrete threshold is crossed. These triggers exist so the decision is observable rather than gut-feel.

| Artefact | Optional at | Becomes required when |
|---|---|---|
| **SDD** (flat file `architecture/sdds/sdd-<slug>.md`) | small / medium | A bounded context has any of: <br>• 3+ ADRs touching it<br>• 5+ public use cases<br>• 3+ aggregate roots<br>• non-trivial cross-aggregate invariant (e.g. "X must reference Y; Y deletion cascades") |
| **FRD** (flat file `architecture/frds/frd-<slug>.md`) | prototype / small (absorbed) | A functionality under an SDD has any of: <br>• fine-grained validation rules / acceptance criteria that don't fit the SDD's invariants<br>• its own Tasks breakdown (the 1–2 day units) worth pinning separately<br>• needs an isolated, closed scope to hand a dev/AI agent in parallel. <br>Below the threshold it stays absorbed in the SDD's "Functionalities" section. Once split, the FRD is 1:1 with the management Feature that realizes it. |
| **`architecture/data-model.md`** | medium | Project has any of: <br>• Versioned migrations (Flyway, sqlx-migrate, drizzle, alembic, etc.)<br>• 2+ entities with cross-table invariants the DB doesn't enforce<br>• A public schema (DB-as-contract, API DTOs that mirror tables) |
| **`dev-pipeline/`** | medium / small | Any of: <br>• 3+ active contributors (human or agent) editing the same docs<br>• Multiple apps/services with shared SAD sections<br>• Doc-merge conflicts happen more than once a sprint |
| **`architecture/threat-model.md`** | all tiers | Any of: <br>• Project accepts untrusted input (HTTP boundary, file uploads, public CLI args, IPC from another process)<br>• Project handles sensitive data (PII, credentials, financial, health, audit trail)<br>• Compliance regime applies (LGPD, GDPR, SOC2, HIPAA, PCI) |
| **Per-module `AGENTS.md`** | prototype | A module reaches 5+ public items OR a second contributor edits it |
| **Outbox pattern (§9)** | medium | Event loss in this flow is unacceptable (billing, audit, compliance, customer-facing notifications) |

When a trigger fires, **the artefact moves from optional to required for the rest of the project's life** — not just for the current sprint. Treat the promotion itself as a small ADR-worthy event: write a one-line entry in `open-questions.md` (resolved section) or the relevant epic's progress log explaining when and why the trigger fired.

### 22.1 Epic *references* an SDD — it does not equal one

There are **two axes** and a **one-way reference** between them:

- **DOCS** live in `architecture/`: `SRS → SAD (+ADRs) → SDD → FRD`. **FRD is the last doc in `architecture/`.** Docs are management-agnostic: they **never** carry `epic:`/`milestone:` fields and never point at management constructs (same spirit as the reverse-boundary rule).
- **MANAGEMENT** lives in roadmap/board/epics: `Milestone → Epic → Feature → Task`. Management **references docs by id** (`sdd:`, `frd:`); the docs never point back.

An **Epic references one SDD** via its `sdd:` field — it is *not* the same object as the SDD. The SDD is the agnostic domain bible; the Epic is the management envelope that delivers it.

**The cardinality ruler:**

| Pair | Cardinality | Note |
|---|---|---|
| Milestone : SDD | 1 : N | a milestone like "auth" spans several domains/SDDs; cross-cutting/infra work sits in a milestone with **no** SDD |
| Epic : SDD | ≈ 1 : 1 | a domain epic references exactly one SDD; a cross-cutting epic references **none** |
| Feature : FRD | 1 : 1 | a Feature **is** the realization of one FRD |
| Task | = DAYS (1–2d) | the smallest management unit; its internal checklist = HOURS. XP/kanban-flow, not Scrum |

Consequences:

- **Cross-cutting epics** (`type: refactor`, `type: infra`) have no bounded context → **no SDD** (leave the epic's `sdd:` blank).
- An **SDD is a coherent DOMAIN** (knowledge + architecture), tagged `subdomain-type: core | supporting | generic` (e.g. `auth` is `generic`). It carries no `epic:` field — the doc is agnostic.
- The trigger above still decides **when a domain context's SDD becomes mandatory** (3+ ADRs, etc.). Before the threshold a small domain epic can carry its tactical notes inline; after it, the SDD is required.
- Authoring an SDD/FRD does **not** produce `research.md`/`plan.md` siblings — the SDD/FRD flat file *is* the one artifact (see §23 and the methodology's RPA section). Durable decisions surfaced while authoring go to an **ADR**.

## 23. Feature placement modes

Where work physically lives is orthogonal to the tier. **The unit that gets placed is the Feature** — one Feature = one FRD (1:1) = one build folder holding a `README.md` (the live trail) **and the code (the Act)**. There is **no `frds/` folder in the build** and **no `act.md`**: the FRD *spec* lives in `architecture/frds/frd-<slug>.md`; the build is keyed by the feature slug. The 1–2 day units inside a Feature are its **Tasks** (a `- [ ]` checklist in the README, sourced from the FRD's Tasks section). Three modes:

### Mode A — Sprint-bound

```
sprints/sprint-NN/
├── README.md
├── planning.md                       (medium+)
└── features/<feature-slug>/
    ├── README.md                     ← live trail: Tasks checklist, surprises, retro
    └── …code…                        ← the Act (or code lives in the source tree, README links it)
```

**When**: team ≥ 3 contributors **or** capacity is the binding constraint (people split across many features, need time-boxing to focus). Sprints exist to box capacity.

### Mode B — Epic-bound (project default)

```
epics/<epic-id>-<slug>/                ← the epic (README frontmatter: sdd: sdd-<slug>)
├── README.md                          ← the epic itself; references its SDD
└── features/<feature-slug>/
    ├── README.md                      ← live trail (frontmatter: frd: frd-<slug>, mode: B)
    └── …code…                         ← the Act
```

**When**: 1–2 contributors using kanban-flow without rigid time-boxes. Features advance as the epic progresses; the rhythm is per-feature, not per-sprint. `sprints/` directory stays empty or absent.

This is the canonical mode for "medium tier without sprints" — the structure you reach for when sprints would be ceremony.

### Mode C — Flat continuous

```
features/<feature-slug>/
├── README.md                          ← live trail; frontmatter has `frd:` (and `epic:` when it exists)
└── …code…                             ← the Act
```

**When**: prototype tier that wants flow discipline without the epic/sprint apparatus. The FRD/SDD layering is absorbed upstream (in `srs+sad.md`), so the placed unit is the feature directly. Each feature is self-contained; epics may or may not exist (when they do, the feature references them via frontmatter).

> **Rare-audit exception:** a feature README never spawns a `research.md`/`plan.md`/`act.md` by default. Only when it genuinely matters to record *what* the AI evaluated and *how* (audit / sensitive handoff) do you promote that one node to a folder and keep a single `research.md` (the plan folded inside) next to the README. Default = no research file; durable decisions go to an ADR.

### Declaring the mode

Project root `AGENTS.md` declares the chosen mode in its "Methodology" section. Example:

```markdown
## Methodology

- **Tier**: medium
- **Feature placement**: Mode B (epic-bound) — single contributor, kanban-flow.
- **Sprint planning**: collapsed into the epic README (no separate `planning.md`).
```

The mode is **not tier-bound**: any tier can use any mode. Pick at instantiation, change later by moving files.

### Promoting / demoting between modes

The flow is bidirectional: as the project grows or shrinks, the mode follows.

```
Mode C (flat)
   │
   │  grows: epic concept becomes useful
   ▼
Mode B (epic-bound)
   │
   │  grows: 3+ contributors, capacity becomes the constraint
   ▼
Mode A (sprint-bound)
   │
   │  shrinks: team contracts, kanban replaces ceremony
   ▼
Mode B (epic-bound)
```

The mechanical promotion is **move the feature build folder + update frontmatter** (the FRD spec stays put in `architecture/frds/`):

- `C → B`: `mv features/<feature-slug>/ epics/<epic-id>-<epic-slug>/features/<feature-slug>/`; set the README's `mode: B` (and `epic:` if you track it).
- `B → A`: create `sprints/sprint-NN/features/<feature-slug>/` and move the feature folder there; set `mode: A`.
- Reverse moves work the same way; nothing destructive. The `frd:` link never changes.

### Tooling

Two Templater snippets cooperate:

- `frd-template.md` authors the FRD **spec** as a flat file at `architecture/frds/frd-<slug>.md`. It is the single artifact — no `research.md`/`plan.md` siblings. Absorbed into the SDD at prototype/small — don't create it there.
- `feature-template.md` creates the feature **build** README (`frd:` + `mode:` frontmatter; the FRD's Tasks become the README's checklist) and asks for the **feature build dir** at creation time:
  - `sprints/sprint-NN` → Mode A → `sprints/sprint-NN/features/<feature-slug>/README.md`
  - an epic path (`epics/002-scheduling`) → Mode B → `epics/002-scheduling/features/<feature-slug>/README.md`
  - the literal string `flat` → Mode C → `features/<feature-slug>/README.md`

Pick the dir that matches your declared mode. The snippet works the same regardless.

### Cross-mode invariants (what stays the same)

Regardless of mode:

- **RPA is a mental discipline (Research → Plan → Act), not a set of files.** It produces exactly **one artifact per node**: the `sdd-<slug>.md`, the `frd-<slug>.md`, and the Feature's code + `README.md`. There are **no** `research.md`/`plan.md`/`act.md` files by default — the code is the Act, the README is the live trail, and any durable decision goes to an **ADR**.
- The feature `README.md` is a **live document** — Tasks (from the FRD) are pulled in as `- [ ]` checklists, checked off as work happens, surprises and punted items captured inline, a short retro at the end. The code is the Act; there is no separate `act.md`.
- The **rare-audit exception** (above) is the only case that adds a single `research.md` next to a node — and only when an audit/handoff genuinely needs the record.
- The DoD (root `AGENTS.md`) gates every feature, in any mode.
- Release on epic close (§16.4) is mode-agnostic.

## 24. Language

This template is maintained for **English** (default) and **Brazilian Portuguese** (`pt_BR`, override). Contributors working in other languages should fork this section and add their own untranslatable terms list — the rules below still apply structurally.

Three rules, in priority order:

### 24.1 Code and code-comments — always English

No exceptions. This covers:

- Identifiers (variables, functions, types, constants, modules, packages).
- Doc-comments / docstrings on any code item.
- Log messages, error messages, panic messages produced by code.
- Commit messages, branch names, tag names.
- File and folder names inside the codebase.
- Test names and assertion messages.

If you find code or code-comments in `pt_BR` (or anything other than English), fix on sight. This rule is non-negotiable — agent sessions reading the codebase rely on English-only identifiers for greppability (§13).

### 24.2 Documentation — prefer English; pt_BR acceptable with declared override

Documentation defaults to **English**. This covers:

- `AGENTS.md` (root and per-module), `README.md`.
- `playbook-*.md`, `methodology.md`.
- `architecture/` artefacts: SRS, SAD, SDDs, ADRs, data-model, threat-model, open-questions.
- Workflow artefacts: backlog/roadmap/epic/sprint/feature files, RPA docs.

**`pt_BR` is acceptable** when declared in the project's `AGENTS.md` → Methodology → `Documentation language`, typically because:

- Team / client / project constraint requires Portuguese.
- Stakeholders consuming the docs don't read English (regulators, end-users for user-facing docs, non-tech stakeholders in Brazil).
- Bilingual delivery (EN + pt_BR alongside) is preferred over single-language `pt_BR` when feasible.

**Never acceptable**: silently writing docs in `pt_BR` because the contributor happens to speak Portuguese. Either declare the override in `AGENTS.md`, or write in English. Mixed-language drift (some files EN, some pt_BR, no declaration) is the failure mode this rule prevents.

### 24.3 Untranslatable domain terms — stay in source language

Terms with no faithful English equivalent stay in their source language. Use them verbatim in both code-comments and docs.

Examples in `pt_BR`: `CPF`, `CNPJ`, `Boleto`, `Pix`, `LGPD`, `Nota Fiscal`, `ICMS`, `SUS`, `SUDAM`.

When the term first appears in a doc, an English gloss in parentheses is encouraged:

> "Tax ID (`CPF` — 11-digit Brazilian individual taxpayer registry)"

After that, use the term bare. Identifiers in code that reference these terms also stay in `pt_BR` (e.g., `cpf: string`, `validate_cnpj()`) — it's the one place where rule 24.1 bends, because translation would lose precision.

### 24.4 Cross-reference

The project's actual choice is declared in `AGENTS.md` → Methodology → `Documentation language`. The default is `English`. The only documented override is `pt_BR`, and it carries a one-line justification.

## 25. Portability

This methodology is intentionally portable. Most teams will stay in markdown + git forever — it's enough through `large` tier. When a project grows large enough that a dedicated ticketing tool (Jira, Linear, GitHub Projects, Asana, Notion) becomes useful, **the workflow layer migrates cleanly**. The docs layer stays in git on purpose.

This section serves two audiences:

1. **Devs onboarding from another methodology** — read the mapping table to translate familiar concepts (Jira Epic, Linear Cycle) into our vocabulary.
2. **Teams considering migration** — read "what migrates vs. what stays" to estimate effort and avoid the trap of lifting docs into a ticketing tool.

### 24.1 Mapping: our methodology ↔ industry tools

| Our concept | Jira | Linear | GitHub Projects | Asana | Notion |
|---|---|---|---|---|---|
| `backlog/<id>-<slug>.md` (card in **Initial/Refining/Ready**) | Issue in Backlog state | Issue in Backlog | Issue + label `backlog` + Project column | Task in Backlog section | Database row |
| `roadmap/<id>-<slug>.md` (card in **Initial/InProgress/Done**) | Issue in Committed/Active state | Issue in Up Next/In Progress | Issue in Project column | Task in Active section | Database row |
| `roadmap/milestones/<slug>.md` (Milestone — delivery grouping) | Initiative | Project / Initiative | Milestone | Portfolio | Database with sub-pages |
| `epics/<id>-<slug>(.md\|/)` (Epic — references one SDD) | Epic | Project | Milestone | Project | Database with sub-pages |
| `sprints/sprint-NN/` | Sprint (Scrum board) | Cycle | Iteration | Section / time-based group | Database view |
| `architecture/frds/frd-<slug>.md` ⇄ feature `README.md` (FRD = one Feature, 1:1) | Story | Issue (child of project) | Issue linked to milestone | Task | Sub-page |
| Task (1–2 day unit; FRD/README checklist item) | Sub-task | Sub-issue | Task checklist item | Sub-task | Checkbox / sub-row |
| `kind: feature\|refactor\|infra\|bug` | Issue Type | Issue Label/Type | Label | Custom field | Multi-select |
| `status: initial \| refining \| ready \| ...` | Workflow Status | Workflow Status | Status field | Section / Status | Status |
| Kanban columns (`_dashboard/board.md`) | Workflow states / Board view | Workflow view | Project view (Board) | Board view | Board view |
| `epic.exits_with` checklist | Epic Done criteria / checklist | Project completion criteria | Milestone task list | Task checklist | Checkbox property |
| `epic.related_decisions` (ADRs/SDDs) | Linked issues / Confluence page links | Doc links | Issue cross-references | Linked tasks | Page mentions |
| `epic.sdd` / `feature.frd` / `roadmap-card.epic` (one-way: management → docs) | Epic Link / Parent | Project ref | Milestone assignment | Parent task | Relation |
| `dependencies` / `blocks` | "Blocks" / "Is blocked by" links | Dependencies | "Tracked by" / mentions | Dependencies | Relation |
| `estimated_cost` (T-shirt) | Story Points | Estimate | Custom field | Custom field | Number |
| `owner` | Assignee | Assignee | Assignee | Assignee | Person property |
| feature `README.md` (live build trail; the code is the Act) | **Confluence or linked git docs** (not in Jira) | Linear Docs or git | Wiki or git | Doc attachments | Sub-pages |
| ADRs / SDDs / FRDs / SRS / SAD / data-model / threat-model | **Stay in git** (Confluence in some hybrids) | **Stay in git** | **Stay in git** | **Stay in git** | **Stay in git** |
| Release on epic close (§16.4) | Automation rule on Epic transition | Cycle close → release | Workflow + release tag | Manual + release notes | Manual |
| `playbook-*.md` / `AGENTS.md` | n/a — stays in git | n/a — stays in git | n/a — stays in git | n/a — stays in git | n/a — stays in git |

The first 13 rows (cards, epics, sprints, fields) are the **workflow layer** — clean migration. The bottom rows (RPA, architecture docs, playbooks, AGENTS.md) are the **docs layer** — these stay in git regardless of which ticketing tool the team adopts.

### 24.2 Why the mapping is clean (not accidental)

The frontmatter on our cards uses the minimum set of fields any issue tracker needs:

```yaml
id            # stable unique key
slug          # human-readable handle
kind          # categorisation (= Jira Issue Type)
epic          # parent grouping (= Jira Epic Link); epic references its SDD via sdd:
frd           # the FRD this feature realizes (= Story link; one-way ref into docs)
status        # workflow state
owner         # = Assignee
dependencies  # = Blocks / Is blocked by
estimated_cost # = Story Points
```

It wasn't designed to mirror Jira specifically. It's the irreducible set, so it mirrors *every* tool.

### 24.3 What migrates vs. what stays

**Migrates to the ticketing tool**:

- All cards (backlog, roadmap, epic, feature frontmatter).
- Kanban state.
- Sprint/cycle structure.
- Dependencies, owners, estimates.

**Stays in git** (and is *intentional*, not a limitation):

| Artefact | Why it stays |
|---|---|
| `architecture/` (SRS, SAD, ADRs, SDDs, FRDs, data-model, threat-model) | Versioned alongside code. The SDD/FRD are the source-of-truth bibles (flat files); doc-comments reference ADRs by number. Refactors must carry provenance forward. |
| feature `README.md` (live build trail) | Working doc next to the code. The build trail — Tasks checklist, surprises, retro — lives beside what it implements; the code is the Act. |
| `playbook-*.md` | Normative for code shape. Lives in the same repo as the code it governs. |
| `AGENTS.md` (root + per-module) | Read by AI agents and humans entering a directory. Must be in the file system. |

The healthy steady state in mature orgs is **hybrid**: Jira/Linear for workflow, git for docs. Our methodology already splits these naturally — `backlogs/roadmap/epics/sprints/` is workflow, `architecture/` (SDD/FRD bibles) + the feature `README.md` build trails is docs — so the split is mechanical when migration happens.

### 24.4 Migration effort (realistic)

For a `medium`-tier project with ~50 cards, ~5 epics, and ~3 active sprints:

| Step | Effort | Notes |
|---|---|---|
| Export YAML frontmatter to CSV | trivial | ~30-line Python/Node script reading frontmatter from `backlogs/`, `roadmap/`, `epics/`, sprint feature files. |
| Import CSV to the target tool | low | Jira CSV import, Linear CSV import, GH `gh issue create` loop. |
| Map `status` enum to tool workflow states | low | One-hour configuration in Jira; Linear works out of the box; GH Projects via Project fields. |
| Map `kind` field to Issue Type / Label | low | Configuration. |
| Configure "Release on epic close" automation | medium | Jira Automation rule on Epic status = Done; Linear Cycle close hook; GH Actions on milestone close. |
| Migrate sprint history | medium | Optional; usually the latest 2-3 sprints is enough. |
| Reproduce DoD per-tier in workflow | medium | Jira Workflow validators / Linear Workflow / GH branch protection. Less expressive than the markdown checklist. |
| Move RPA docs into Confluence | **not recommended** | Keep in git; link from the ticket. |
| Move architecture docs into Confluence | **not recommended** | Keep in git; link from the ticket. |

**Total realistic effort**: 1–3 days of one engineer for the full migration, no information loss. Bidirectional: the same script can re-export from the ticketing tool back to markdown if the team ever wants to leave.

### 24.5 What you lose with full migration (and why hybrid wins)

If the team is tempted to put everything in Jira:

- **Milestone → Epic → Feature → Task** maps cleanly (Initiative → Epic → Story → Sub-task), but the **one-way `sdd:`/`frd:` references** into the agnostic docs become brittle external links once docs leave git.
- **Doc-comment provenance** (invariants, emitted events, ADR links — §12) only makes sense in code. Jira tickets can't carry it.
- **DoD tier-aware checklists** in `AGENTS.md` are richer than what Jira Workflow validators express. Keeping them in code keeps them under code review.
- **Promotion triggers (§22)** like "3+ ADRs on a context ⇒ SDD required" are observable by `rg adrs/ | wc -l`, not by counting Jira custom field values.
- **Vault-relative cross-references** (`[[../adrs/0007-oauth|ADR-0007]]`) become external links that break when tickets are archived.
- **Offline-first workflow** (cards as files, kanban as `.md` rendered by Obsidian Kanban plugin) gives diff-able history. Jira state lives in Atlassian's database.

The hybrid model preserves these properties: ticketing tool for assignment/scheduling/team coordination; git for the durable, code-coupled artefacts.

### 24.6 When to actually migrate

Don't migrate just because a project crossed an arbitrary size. Migrate when **one or more** of these hold:

- The team is large enough that "who is working on what" can't be answered by reading kanban `.md` files (typically 5+ contributors).
- Stakeholders outside the engineering team need to read/update tickets (product, support, sales).
- Compliance or audit requires an immutable workflow history outside git.
- Integration with another system (Slack notifications on status change, Salesforce sync, etc.) is needed.

If none of these are true, **stay in markdown**. The methodology is not under-tooled — it's right-tooled for code-coupled work.
