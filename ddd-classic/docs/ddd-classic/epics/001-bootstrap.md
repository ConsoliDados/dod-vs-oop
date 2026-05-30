---
id: EPIC-001
slug: bootstrap
type: phase
status: active
owner: Johnny Carreiro
target_window: 2026-05-18 .. 2026-05-21
roadmap_cards: []
sprints: []
related_decisions: [ADR-0001, ADR-0002, ADR-0003]
exits_with:
  - project scaffolded (NestJS + TypeORM + Vitest + Biome + pnpm)
  - DDD core copied from ddd-templates with throw-based overrides
  - shared VOs + in-memory EventBus
  - methodology template applied (docs/<project>/ + AGENTS.md + CLAUDE.md)
  - foundational docs written (SRS, SAD, ADR-0001..0003)
  - smoke + e2e green, typecheck + biome clean
---

# EPIC-001 — bootstrap

> **Phase epic.** Captures the project setup performed via direct commits to `dev` (the bootstrap-phase exception in `AGENTS.md`). Once its `exits_with` are all checked and EPIC-002 starts, every change goes through the §16.3 feature loop.

## Why

A comparative-study foil needs a faithful, working skeleton before any domain feature is written: the verbose-canonical OOP stack, the DDD building blocks (throw-based), the documentation machinery, and the foundational architecture decisions. This epic groups that one-time setup so the transition to feature-flow is explicit.

## Outcome

A buildable, tested, documented NestJS project whose `core/` reflects the verbose-canonical (throw-based) DDD style, with the methodology vault (`docs/ddd-classic/`) in place and the foundational docs (SRS shared, SAD + ADRs specific) written. `pnpm check` + `pnpm test` green.

## Scope (in)

- NestJS + Express + TypeORM + better-sqlite3 scaffold; Vitest + Biome + pnpm tooling (ADR-0001).
- `core/` copied from `~/Dev/projects/ddd-templates` with 5 throw-based overrides (ADR-0002).
- `shared/` VOs (`Identifier`, `Money`) + synchronous in-memory `EventBus` (ADR-0003).
- Methodology scaffold: `docs/ddd-classic/`, root `AGENTS.md` + `CLAUDE.md`, single project `playbook.md`, CI workflow.
- Foundational docs: `srs.md` (shared), `sad.md`, ADR-0001..0003.

## Out of scope

- Any domain feature (accounts, ledger, statements, reconciliation) — those start at EPIC-002.
- Per-context SDDs — created with their context (promotion trigger).

## Exits with

- [x] Project scaffolded (NestJS + TypeORM + Vitest + Biome + pnpm)
- [x] DDD `core/` with throw-based overrides; no `Result`
- [x] Shared VOs + in-memory EventBus
- [x] Methodology template applied (`docs/<project>/` + `AGENTS.md` + `CLAUDE.md` + playbook + CI)
- [x] Foundational docs written (SRS, SAD, ADR-0001..0003)
- [x] `pnpm check` clean (biome + typecheck); `pnpm test` green (12/12)
- [ ] Declare bootstrap complete and open EPIC-002 (this epic moves to Done when ledger-core activates)

## Related decisions

- ADR-0001 — Stack: NestJS + Express + TypeORM + better-sqlite3 (`:memory:`)
- ADR-0002 — Throw on first violation (no `Result<T, E>`)
- ADR-0003 — Synchronous in-memory EventBus (no Outbox)

## Risks / open questions

- None outstanding. The stack-confounder vs the DOD side is acknowledged in ADR-0001 and the study README.

## Progress log

- 2026-05-18 — Scaffold + core overrides + shared VOs + EventBus + methodology template applied; smoke green.
- 2026-05-21 — Foundational docs (SRS/SAD/ADRs) written. Bootstrap substantively complete; EPIC-002 (ledger-core) planned.
