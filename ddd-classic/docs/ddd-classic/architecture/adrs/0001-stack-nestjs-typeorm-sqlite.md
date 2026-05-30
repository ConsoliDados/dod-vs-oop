# ADR-0001 — Stack: NestJS + Express + TypeORM + better-sqlite3 (`:memory:`)

- **Status:** Accepted
- **Date:** 2026-05-21
- **Phase / Sprint:** 0 (bootstrap)

## Context

This project is the **verbose-canonical OOP foil** of a comparative study against a DOD implementation of the same [`srs.md`](../srs.md). For the foil to be honest (not a strawman), it must mirror how verbose DDD actually ships in production. The reference is the author's real production codebase `a real-world production ledger system`, which runs NestJS + TypeORM.

Two further constraints from the study:
- Benchmarks must measure architecture/stack effects, not disk I/O — so persistence must be in-process.
- The sibling `ddd-dod` runs Bun + Elysia + in-memory; the stack difference between the two is a **known confounder**, deliberately accepted and documented in the study `FAQ.md`/`BENCHMARKS.md`.

## Decision

We will build this project on **Node.js 20 + NestJS 11 (Express adapter) + TypeORM**, persisting to **better-sqlite3 with `:memory:`**. Tooling: **Vitest** (tests) + **Biome** (lint/format) + **pnpm** (package manager), replacing the Jest/ESLint/Prettier defaults from the Nest CLI.

## Alternatives considered

- **(a) Fastify adapter instead of Express** — rejected: the production reference uses Express; switching would reduce fidelity for negligible study value.
- **(b) Prisma instead of TypeORM** — rejected: `the production reference` uses TypeORM with bidirectional mappers; Prisma's generated client would change the repository/mapper shape that is part of the foil's character.
- **(c) Postgres (durable) instead of sqlite `:memory:`** — rejected: introduces disk/network I/O variance that would dominate the CPU-bound benchmarks and obscure the architectural comparison.
- **(d) Match the DOD stack (Bun + Elysia) to remove the confounder** — rejected for the MVP: it would make the foil unfaithful to real-world verbose DDD. Captured instead as future work (`ddd-modern`, see SAD §8).

## Consequences

- **Positive**: high fidelity to a real production verbose-DDD codebase; in-process DB keeps benchmarks clean; mainstream stack that the LinkedIn audience recognizes (resists "toy example" criticism).
- **Negative**: the stack differs from the DOD side, so raw performance deltas mix architecture + stack effects. Mitigated by (1) documenting the confounder prominently, (2) running the *same* algorithm on both sides, (3) the planned `classic-modern` variant.
- **Follow-up**: ADR-0002 (error strategy) and ADR-0003 (event delivery) refine how this stack is used.

## References

- `../srs.md` — shared domain contract
- `../sad.md` §2, §5.4 — architectural style and persistence
- `a real-world production ledger system` — production reference
- Study `../../../../README.md` — stack-confounder rationale
