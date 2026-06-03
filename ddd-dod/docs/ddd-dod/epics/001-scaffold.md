---
id: EPIC-001
slug: scaffold
type: infra
status: done
owner: Johnny Carreiro
milestone: MILESTONE-001 (bootstrap)
target_window: 2026-06-03 .. 2026-06-03
sdd: null
exits_with:
  - Bun workspace monorepo scaffolded (types + platform + shared-kernel + modules/* + apps/api)
  - methodology vault applied (docs/ddd-dod/ medium tier + AGENTS.md + CLAUDE.md + playbook-base + playbook-ts)
  - "@ddd-dod/types results-globals wrapper wired (ADR-0005); repo-root CI ci-ddd-dod.yml"
  - package + tactical stubs compile; bun run check clean; bun test green
  - Elysia /health boots on PORT (default 3333)
---

# EPIC-001 — scaffold

> **Infra epic** under MILESTONE-001 (bootstrap). The **static** half: structure, configuration, docs, and stubs that compile and boot a minimal health route. The **living** runtime foundation (logger / DI / bootstrap / app, built for real) is EPIC-002 (active-foundation).

## Why

Before the runtime foundation can be built feature-by-feature, the project needs a faithful, compiling skeleton: the Bun workspace shape, the toolchain, the documentation machinery, and the foundational ADRs. This epic is the static scaffold; it was performed on `epic/scaffold` (bootstrap-phase commits) and PRs into `milestone/bootstrap`.

## Scope (in)

- Bun workspace: `apps/api` + `packages/{types, platform, shared-kernel, modules/*}` (ADR-0001).
- `@ddd-dod/types` — the `@consolidados/results` globals wrapper (ADR-0005): `./globals` + `./globals-types`; sole results dependant.
- Methodology vault (medium tier), root `AGENTS.md` + `CLAUDE.md`, `playbook-base.md` + `playbook-ts.md`, repo-root CI `ci-ddd-dod.yml`.
- Foundational docs: `srs.md` (shared), `sad.md`, ADR-0001..0006.
- **Skeletons only** for the runtime pieces — enough to compile and boot `/health`:
  - functional logger (real implementation, but no request-correlation middleware yet)
  - token-based DI container (basic register/resolve; no lifecycle/dispose yet)
  - config loader, clock, db handle, outbox **ports** (no dispatcher)
  - Elysia app with a single `/health` route + a thin composition root

## Out of scope (handed to EPIC-002 — active-foundation)

- Building the logger / DI / config / `bootstrap()` / Elysia app **"for real"** (lifecycle, graceful shutdown, request-scoped logging, `Err`→HTTP error envelope, readiness) — each becomes a feature with its own FRD.
- Any domain feature (EPIC-003, ledger-core).
- Outbox dispatcher runtime (deferred to the ledger-core milestone).

## Exits with

- [x] Bun workspace scaffolded (types + platform + shared-kernel + modules/* + apps/api)
- [x] Methodology vault applied (medium tier + AGENTS + CLAUDE + playbooks)
- [x] `@ddd-dod/types` results-globals wrapper wired (ADR-0005); repo-root CI added
- [x] Foundational docs written (SRS shared, SAD, ADR-0001..0006)
- [x] Stubs compile; `bun run check` clean; `bun test` green (15/15)
- [x] Elysia `/health` boots on `PORT` (default 3333)

## Related decisions

- ADR-0001 — Stack (Bun + Elysia + Drizzle + sqlite `:memory:`)
- ADR-0002 — Result + Notification (no `throw`)
- ADR-0003 — Transactional Outbox (ports only here)
- ADR-0004 — Token-based DI container
- ADR-0005 — `@consolidados/results` via the `@ddd-dod/types` wrapper
- ADR-0006 — Validation scope (Zod at external boundaries only)

## Progress log

- 2026-06-03 — Scaffold complete: structure + medium-tier docs + ADR-0001..0006 + results-globals wrapper (`@ddd-dod/types`) + CI. `bun run check` clean; `bun test` 15/15; `/health` boots on 3333. Re-cut from the original `001-bootstrap` (which wrongly modeled bootstrap as a `phase` epic): bootstrap is now MILESTONE-001, this is the scaffold epic, and the runtime foundation moves to EPIC-002.
