# ADR-0001 — Stack: Bun + Elysia + Drizzle + sqlite (`:memory:`)

- **Status:** Accepted
- **Date:** 2026-06-03
- **Phase / Sprint:** 0 (bootstrap)

## Context

This project is the **Data-Oriented Design** implementation of a comparative study against `ddd-classic` (verbose-canonical OOP) over the same shared [`srs.md`](../srs.md). Two constraints frame the stack:

- Benchmarks must measure architecture effects, not disk I/O — persistence must be in-process.
- The study isolates confounders across three implementations. `ddd-dod` and the planned `ddd-modern` share **Bun + Elysia + Drizzle**, so that the `ddd-dod` vs `ddd-modern` delta is attributable to architecture (DOD vs verbose OOP), while `ddd-classic` (NestJS/TypeORM) carries the stack confounder against the production reference.

## Decision

Build on **Bun** (runtime + test runner) + **Elysia** (HTTP) + **Drizzle** over **better-sqlite (`:memory:`)**. Tooling: **Biome** (lint/format), **`bun:test`** (tests), **TypeScript strict** with `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. Package manager: Bun workspaces.

## Alternatives considered

- **(a) Postgres + Slonik (raw SQL), as in the author's reference queue design** — rejected for the study: durable DB introduces I/O variance that would dominate the CPU-bound benchmarks. The *infra style* from that design (factory adapters, no class, `tryAsync` at the boundary, no Zod on the own read path) is adopted regardless; only the engine differs. Revisit via ADR if the query layer becomes a measured variable.
- **(b) Match `ddd-classic`'s stack (NestJS/TypeORM)** — rejected: would erase the architectural contrast that is the point of this implementation.
- **(c) vitest instead of `bun:test`** — rejected: `bun:test` is zero-config on Bun and keeps the toolchain single-runtime (playbook-ts §1).

## Consequences

- **Positive**: in-process DB keeps benchmarks clean; shared stack with `ddd-modern` isolates architecture; modern, fast toolchain.
- **Negative**: differs from `ddd-classic`'s stack — raw deltas vs classic mix architecture + stack. Mitigated by `ddd-modern` (same stack, classic architecture) and by running the same algorithm on all sides.
- **Follow-up**: ADR-0002 (errors), ADR-0003 (events), ADR-0005 (Result lib), ADR-0006 (validation scope) refine how this stack is used.

## References

- `../srs.md` — shared domain contract
- `../sad.md` §2, §5 — architectural style and persistence
- Study `../../../README.md` — three-way confounder rationale
