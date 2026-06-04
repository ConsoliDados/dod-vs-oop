# Benchmarks — DOD vs OOP

> **Status: methodology defined, numbers pending.** The harness is built once both
> implementations land; this document fixes *how* we measure so the results are fair,
> reproducible, and honest. Decision record: ADR-0007 in `ddd-classic`.

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

Rinha-inspired (reverse proxy + **2 instances** + DB on a tight budget), run at **two
hardware tiers** so we see each stack both **suffer under a hard cap** and **breathe**. Each
side is 4 containers (nginx + 2 api + postgres); the limit is the **whole side's** budget,
split across its services (docker `cpus`/`mem_limit`):

| Service | Tier A — austere | Tier B — roomy |
|---------|------------------|----------------|
| nginx (LB) | 0.15 CPU / 32 MB | 0.30 CPU / 96 MB |
| api ×2 | 0.45 CPU / 160 MB each | 1.0 CPU / 512 MB each |
| postgres | 0.45 CPU / 196 MB | 0.70 CPU / 384 MB |
| **total / side** | **1.5 CPU / 548 MB** | **3.0 CPU / 1.5 GB** |

- **Tier A** = survival under a hard cap. The lean DOD/Bun side fits (~380 MB); the verbose
  OOP/Nest side rides the **OOM edge** (~520 MB+) — part of the finding. An OOM-killed side
  is recorded as a survival failure, not a throughput number.
- **Tier B** = clean throughput, both stable — the comparable req/s come from here.

**Core pinning (hybrid CPU, e.g. i9-14900HX: P-cores `cpuset 0-15`, E-cores `16-31`):** the
measured **api** containers pin to **P-cores**, identical on both sides; **postgres + nginx +
the k6 load generator** pin to **E-cores** so infra and the attacker never steal a P-core
from the measured code. **One side at a time (sequential)** — each side gets the full P-core
budget, zero cross-side contention.

**`nginx`** is the reverse proxy / LB (tiny footprint, no GC → predictable tail latency; not
Traefik). **Proxy is identical on both sides** — not the variable.

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
- **dod / modern (Elysia)** — Drizzle behind a repository **port**, with **two concrete
  adapters** (sqlite + pg) per bounded context; the composition root picks the driver from
  config (`DATABASE_URL`). **Not** an env-flag dual-schema — ports/adapters keep the domain
  driver-agnostic (ADR-0012 in `ddd-dod`; the driver is chosen in the dirty layer).
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

## Extra — parallelism (dod vs dod + thread-workers)

Outside the 2×2 (which compares implementations): a **within-`ddd-dod`** comparison of the
CPU-bound paths (statement generation, reconciliation) **baseline vs offloaded to a Bun
worker-pool** — each worker bootstraps its own DI container (share-nothing). Measures what
multicore parallelism buys the DOD implementation: throughput / tail-latency / scaling
across N workers, with vs without workers.

`ddd-classic` is **not** run with workers here — that is the finding. The post pairs the
number with a **qualitative code-snippet** comparison of the worker boundary: DOD ships
plain data (`pool.run(data)`, TypedArrays transfer zero-copy) while OOP must rehydrate
entities, re-bootstrap a Nest context per worker, and cannot send behavior across the
thread boundary. Infra already built: the `ddd-dod` `platform` worker-pool
(`createWorkerPool`/`serveWorker`) + the merged worker+DI demo (its seed).

## Results

_TBD — built once both implementations exist. One table per benchmark: throughput,
p50/p99 latency, error rate, plus the cross-cell decomposition._

## Tooling

- **Load generator: k6** — JS-scripted scenarios, used across all benchmarks for
  comparability (fits the multi-step, stateful workloads; reliable percentiles + thresholds).
  oha/bombardier may complement it for hammering isolated CPU-bound endpoints.
