---
id: EPIC-002
slug: active-foundation
type: infra
status: planned
owner: Johnny Carreiro
milestone: MILESTONE-001 (bootstrap)
target_window: 2026-06-03 .. TBD
sdd: null
feature_placement: B
exits_with:
  - config loader (Zod env, Result, PORT default 3333) shipped + tested
  - functional logger (sinks, redaction, request-scoped child) shipped + tested
  - token-based DI container (lifecycle + dispose + test substitution) shipped + tested
  - bootstrap() runtime (compose + graceful shutdown) shipped + tested
  - Elysia app (Err->HTTP envelope, request-id middleware, health/readiness) shipped + tested
  - bun run check clean; bun test green; app boots + shuts down cleanly
---

# EPIC-002 — active-foundation

> **Infra epic** under MILESTONE-001 (bootstrap). Cross-cutting → references **no** SDD. The **living runtime foundation**: the parts a classic stack (NestJS) hands over pre-built — logger, DI container, app factory, lifecycle — implemented explicitly here. Builds on the EPIC-001 skeletons, replacing "compiles + boots minimal" with "production-shaped + tested".

## Why

`ddd-dod` deliberately forgoes a batteries-included framework (ADR-0001). That means the runtime foundation is ours to build: configuration, structured logging, dependency wiring, the startup/shutdown sequence, and the HTTP app with a consistent error contract. Doing this as explicit, tested features (rather than letting a framework hide it) is part of what the study measures and documents.

## Feature placement

**Mode B (epic-bound)** — features live at `epics/002-active-foundation/features/<slug>/` (the live build trail + code); each feature's spec is a flat FRD at `architecture/frds/frd-<slug>.md` (written when the feature is picked up — RPA as mental discipline). Sprint planning is collapsed into this README.

## Features

Each feature = one FRD = one `feat/<slug>` branch (merged locally into `epic/active-foundation`).

| # | Feature | `feat/` branch | Intent | Depends on |
|---|---------|----------------|--------|-----------|
| FEAT-001 | config | `feat/config` | Typed env loader via Zod (`AppConfig`); failure as `Result` (no throw); `PORT` default 3333, never 3000 (ADR-0006) | — |
| FEAT-002 | logger | `feat/logger` | Functional structured logger: levels, console sink (json/pretty), key redaction, `child`/request-correlation. Functional style of the `my-approfile` logger; **not** the singleton/class style of the `conecta` logger | — |
| FEAT-003 | di-container | `feat/di-container` | Token-based container hardened: lazy singletons, `dispose` on shutdown, test substitution; composition-root-only (ADR-0004) | — |
| FEAT-004 | app-bootstrap | `feat/app-bootstrap` | The `bootstrap()` runtime: compose config → logger → container → app; graceful shutdown (SIGINT/SIGTERM); lifecycle/dispose ordering | 001, 002, 003 |
| FEAT-005 | http-app | `feat/http-app` | Elysia app: `Err`→HTTP error envelope (SRS NFR-OBS-001), request-id + request-scoped logger middleware, health/readiness endpoints, 404/422/500 shapes | 002, 004 |

Dependency order: **001 → (002, 003 in parallel) → 004 → 005**.

## Out of scope

- Any domain feature (ledger/accounts/statements/reconciliation) — EPIC-003 (ledger-core).
- Outbox dispatcher runtime — deferred to the ledger-core milestone (only ports exist).
- Auth/security — out of study scope (SRS §2.2).

## Cross-project references (by name, never by path)

Per playbook §20 and the workspace reverse-boundary, docs here reference other projects by **name/role only**:
- **`my-approfile`** — the reference for the functional logger shape (factory + immutable `child`, no class).
- **`conecta`** — the anti-reference: a class/singleton logger to avoid.
- **`ddd-classic`** — the OOP foil; its NestJS-provided equivalents (DI, app factory, lifecycle) are what these features build by hand.

## Exits with

- [x] FEAT-001 config — shipped + tested
- [ ] FEAT-002 logger — shipped + tested
- [ ] FEAT-003 di-container — shipped + tested
- [ ] FEAT-004 app-bootstrap — shipped + tested
- [ ] FEAT-005 http-app — shipped + tested
- [ ] `bun run check` clean; `bun test` green; app boots and shuts down cleanly
- [ ] Epic PR'd into `milestone/bootstrap`

## Progress log

- 2026-06-03 — Epic planned; five features scoped (config, logger, di-container, app-bootstrap, http-app), dependency-ordered. FRDs to be written per-feature as each is picked up.
- 2026-06-03 — FEAT-001 config shipped (`feat/config`): FRD-001 + hardened loader (`Readonly`/`Object.freeze`, non-strict env per ADR-0006) + `formatConfigError` + `main.ts` wiring + 8 tests. `bun run check` clean; `bun test` 23/23; boot prints a per-issue error on bad `PORT` and exits 1. Merged locally into `epic/active-foundation`.
