# ADR-0007 — Benchmark methodology: 2×2 matrix on a resource-constrained topology

- **Status:** Accepted
- **Date:** 2026-05-22
- **Phase / Sprint:** EPIC-002 (decided during FEAT-002 review); harness built later (BENCHMARKS.md phase)

## Context

ADR-0001 chose better-sqlite3 `:memory:` to isolate architecture/stack effects from disk I/O, and rejected Postgres ("I/O variance would dominate the CPU-bound comparison"). That yields a clean *isolated* number but says nothing about **real-world** behavior, and a single benchmark cannot separate the three confounders the study cares about: the **stack** (NestJS vs Bun/Elysia), the **architecture** (verbose-canonical OOP vs DOD), and **DB I/O**.

This is a study-level decision: it applies to all implementations (`dod-vs-oop-classic`, `dod-vs-oop-dod`, and the `classic-modern` re-host) and is mirrored in the sibling projects.

## Decision

Run **four benchmarks** as a 2×2 factorial — `{stack} × {persistence}` — so each comparison moves exactly one variable:

| # | Implementations compared | Persistence | Isolates |
|---|--------------------------|-------------|----------|
| 1 | classic (NestJS + TypeORM) vs dod (Bun/Elysia) | Postgres (constrained) | nothing — **real-world** (stack + architecture + I/O) |
| 2 | classic vs dod (native stacks) | sqlite `:memory:` | removes DB I/O |
| 3 | both on **Elysia** (classic-modern vs dod) | Postgres (constrained) | **architecture** (stack equalized), real-world |
| 4 | both on **Elysia** | sqlite `:memory:` | **pure architectural delta** (stack + I/O removed) |

Decomposition by comparing cells: **1↔2** = weight of DB I/O; **1↔3** (or **2↔4**) = weight of the stack; **bench 4** = the cleanest architectural delta.

**Constrained topology (benches 1 & 3)** — the Rinha de Backend 2023 q3 budget, via docker-compose resource limits:

| Service | CPU | Memory |
|---------|-----|--------|
| nginx (load balancer) | 0.25 | 0.5 GB |
| api1 | 0.25 | 0.5 GB |
| api2 | 0.25 | 0.5 GB |
| postgres | 0.75 | 1.5 GB |
| **total** | **1.5** | **3 GB** |

**Persistence portability:** the classic stack uses **TypeORM** (multi-dialect). The modern stack (Elysia, both sides in benches 3 & 4) uses **Drizzle** with an **env-var flag** selecting `pg-core` vs `sqlite-core` at runtime — a verbose dual-dialect schema, accepted as the cost of portability. `sqlite :memory:` also remains the integration/e2e **test** database, always, independent of the benchmarks.

**Load generator: k6** (Go engine, JS-scripted scenarios) for all benchmarks — it fits the multi-step, stateful workloads (open account → post transaction → statement), gives reliable latency percentiles and pass/fail thresholds, and the off-stack runtime is fine since scenarios are authored in JS. (Considered and rejected: Gatling — Kotlin/JVM, off-stack; autocannon — on-stack but thinner for complex scenarios; oha/bombardier — great for hammering a single endpoint, weak for stateful flows, may still complement for isolated CPU-bound endpoints.)

**Fairness / no strawman:** the harness is **identical** for the pair compared in each benchmark (same workload, load tool, resource limits, seed, fixed clock). The **conformance gate** (SRS NFR-CORRECT-001 — byte-identical JSON for the same fixtures) must pass before any performance number counts.

## Alternatives considered

- **(a) Single `:memory:` benchmark (ADR-0001 as-is)** — rejected: no real-world claim, and it cannot separate the confounders.
- **(b) Single Postgres real-world benchmark** — rejected: I/O dominates and hides the architectural delta; there is no isolated control.
- **(c) Unconstrained Postgres** — rejected: results become machine-dependent and don't stress the app-layer efficiency (allocations / GC pressure) where the architecture actually matters.
- **(d) Raw `pg` / pg-promise for the modern stack** — rejected in favour of Drizzle + env-flag: keep an ORM on both modern sides and accept schema verbosity instead of maintaining bespoke SQL.

## Consequences

- **Positive:** an honest decomposition — real-world *and* isolated — with each number tied to a single named, controlled confounder. This is the opposite of a rigged comparison.
- **Negative:** 4× the runs; all three codebases (classic, dod, classic-modern) must support both Postgres and sqlite; more harness machinery; the Drizzle dual-dialect schema is verbose.
- **Refines, does not supersede ADR-0001** — the sqlite/dev/test stack stays valid; this adds the Postgres real-world axis and the matrix.

## Open items

- Make the classic TypeORM entities portable Postgres↔sqlite (`datetime` / `simple-json` / `bigint` / `PrimaryGeneratedColumn` differ per dialect) — handle in the harness phase.
- The dod side currently uses an in-memory `Map` repository — it needs real Drizzle persistence for the benchmarks.

## References

- ADR-0001 — stack + sqlite `:memory:` (refined here, not superseded)
- Rinha de Backend 2023 q3 — resource-constrained topology reference (its API rules are otherwise ignored; only the constraints are adopted)
- `../srs.md` NFR-PERF-001/002, NFR-CORRECT-001 — perf targets + the conformance gate
- `../sad.md` §7 (deployment), §8 (the `classic-modern` variant)
- `../../../../BENCHMARKS.md` — public methodology + results table (numbers TBD post-harness)
- `../../../../README.md` (study overview), `../../../../../PLAN.md` (internal plan)
