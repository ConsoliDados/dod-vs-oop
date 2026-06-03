---
id: MILESTONE-001
slug: bootstrap
status: active
owner: Johnny Carreiro
target_window: 2026-06-03 .. TBD
epics:
  - EPIC-001 — scaffold
  - EPIC-002 — active-foundation
sdds: []
---

# MILESTONE-001 — bootstrap

> **Temporal grouping**, not an epic (playbook §22.1: bootstrap / MVP / v1 are milestones). Cross-cutting / infra — references **no** SDD (Milestone : SDD = 1 : N; an infra milestone has none).

## Goal

Take `ddd-dod` from nothing to a **buildable, tested, runnable** Bun monorepo whose runtime foundation (the parts a classic stack like NestJS hands over pre-built — logger, DI, app factory, lifecycle) is implemented explicitly, before any domain feature.

## Epics

| Epic | Type | Status | Scope |
|------|------|--------|-------|
| EPIC-001 — scaffold | infra | done | Static structure: Bun workspace, configs, docs vault (medium tier), `@ddd-dod/types` results-globals wrapper, package stubs, CI, minimal `/health` boot |
| EPIC-002 — active-foundation | infra | planned | The living runtime foundation, built "for real" as features: config, logger, DI container, `bootstrap()` runtime, Elysia app + error handling |

## Exit criteria (milestone)

- [x] EPIC-001 (scaffold) closed — structure compiles, `bun run check` clean, `bun test` green, `/health` boots on 3333.
- [ ] EPIC-002 (active-foundation) closed — all five features shipped with their FRDs and tests.
- [ ] `dev` carries a runnable foundation ready for EPIC-003 (ledger-core, the first domain milestone).

## Branching

Per the project git flow (see root `AGENTS.md` → Branching): this milestone lands on `milestone/bootstrap`. Epics branch off it (`epic/scaffold`, `epic/active-foundation`); features branch off their epic (`feat/<slug>`) and **merge locally** into the epic; the epic merges into this milestone via **PR**; this milestone merges into `dev` via **PR**.

## Notes

- Outbox dispatcher (runtime) is **deferred** to the ledger-core milestone — it has no consumer until the first cross-context event exists. Only the ports live here (in the scaffold).
- Numbering is sequential and intentionally **not** parallel to `ddd-classic` (whose EPIC-002 is ledger-core); the methodology granularity differs, and docs are themselves a comparison axis of the study.
