# Benchmarks — DOD vs OOP

> **Status: methodology defined, numbers pending.** The harness is built once both
> implementations land; this document fixes *how* we measure so the results are fair,
> reproducible, and honest. Decision record: ADR-0007 in `dod-vs-oop-classic`.

## Why four benchmarks (a 2×2 design)

A single benchmark cannot separate the three things that affect throughput here: the
**stack** (NestJS vs Bun/Elysia), the **architecture** (verbose-canonical OOP vs DOD),
and **DB I/O**. So we run a 2×2 factorial — `{stack} × {persistence}` — and read the
*differences* between cells, where each comparison moves exactly one variable.

| # | Implementations compared | Persistence | Isolates |
|---|--------------------------|-------------|----------|
| 1 | classic (NestJS + TypeORM) vs dod (Bun/Elysia) | Postgres (constrained) | nothing — **real-world** (stack + architecture + I/O) |
| 2 | classic vs dod (native stacks) | sqlite `:memory:` | removes DB I/O |
| 3 | both on **Elysia** (classic-modern vs dod) | Postgres (constrained) | **architecture** (stack equalized), real-world |
| 4 | both on **Elysia** | sqlite `:memory:` | **pure architectural delta** (stack + I/O removed) |

**Reading the matrix:**
- **1 ↔ 2** — how much of the delta is **DB I/O**.
- **1 ↔ 3** (or **2 ↔ 4**) — how much is the **stack** (NestJS vs Bun/Elysia).
- **Bench 4** — the cleanest **architectural** delta (verbose OOP vs DOD), stack and I/O removed.

## Real-world topology (benches 1 & 3)

Resource-constrained, modeled on the Rinha de Backend 2023 q3 budget (docker-compose limits):

| Service | CPU | Memory |
|---------|-----|--------|
| nginx (load balancer) | 0.25 | 0.5 GB |
| api1 | 0.25 | 0.5 GB |
| api2 | 0.25 | 0.5 GB |
| postgres | 0.75 | 1.5 GB |
| **total** | **1.5** | **3 GB** |

Two API instances behind a proxy on a tight CPU/memory budget — the conditions where
app-layer efficiency (allocations, GC pressure, object-graph traversal) actually moves
throughput, which is exactly where the architectural difference should show.

Benches 2 & 4 drop the topology and run in-process against sqlite `:memory:` (no DB I/O),
for the isolated/controlled numbers.

## Fairness & honesty

- **Conformance gate first.** Before any performance number counts, both implementations
  must return **byte-identical JSON** for the same fixtures (fixed clock) — see the SRS
  conformance requirement. A benchmark of a wrong/divergent implementation is worthless.
- **Identical harness per pair.** Same workload, same load tool, same resource limits,
  same seed — only the independent variable of that benchmark differs.
- **Warmup.** Runs include a warmup phase (the JIT optimizes monomorphic classes; cold
  numbers would mislead).
- **Stack-confounder disclaimer.** Part of any raw delta in benches 1 & 2 comes from the
  **stack**, not the architecture — which is precisely why benches 3 & 4 equalize the
  stack (both on Elysia) to isolate the architecture.

## Persistence

- **classic** — TypeORM (multi-dialect: Postgres for benches 1/3, sqlite for 2/4).
- **modern (Elysia, both sides in 3 & 4)** — Drizzle with an env-var flag selecting the
  `pg` or `sqlite` dialect at runtime (verbose dual schema, accepted).
- `sqlite :memory:` is also the integration/e2e **test** DB throughout, independent of these benchmarks.

## Harness components

The "test rig" wrapped around the apps (built in this phase):

1. **Topology** — the docker-compose with the resource limits above (benches 1 & 3).
2. **Load generator — k6** — JS-scripted scenarios fire requests at rising concurrency and
   collect throughput (req/s), latency p50/p99, error rate, with pass/fail thresholds.
3. **Workloads** — realistic request mixes, especially the CPU-bound paths (statement
   generation over ~10k postings, reconciliation ~50k×50k).
4. **Seed / fixtures** — deterministic data + fixed clock for comparable, conformant runs.
5. **Conformance check** — byte-identical JSON gate.
6. **Metrics + reporting** — aggregation into the results table below.
7. **Orchestration** — scripts to spin up, warm up, run each of the 4 configs, tear down.

## Results

_TBD — built once both implementations exist. One table per benchmark: throughput,
p50/p99 latency, error rate, plus the cross-cell decomposition._

## Tooling

- **Load generator: k6** — JS-scripted scenarios, used across all benchmarks for
  comparability (fits the multi-step, stateful workloads; reliable percentiles + thresholds).
  oha/bombardier may complement it for hammering isolated CPU-bound endpoints.
