# Parallelism axis — `ddd-dod` inline vs `ddd-dod` + thread-workers

The Phase-3 **Extra** of the study (examples-root `BENCHMARKS.md` §"Extra — parallelism").
A **within-`ddd-dod`** comparison: the CPU-bound paths run **inline on the event loop**
vs **offloaded to a share-nothing Bun worker-pool**. It isolates one variable —
*where the CPU work runs* — with everything else held constant.

> **Status: scaffold (stub until EPIC-003).** Structure + tooling are in place and the
> servers boot today against a **CPU stand-in** (`cpu-job.ts`). The real jobs
> (`statements` generation, `reconciliation` matching) land in EPIC-003 — swap them into
> `cpu-job.ts` and the whole harness measures the real thing. Not an end-to-end number yet.

## The two arms

| Arm | File | CPU runs… | Expected behavior under load |
|-----|------|-----------|------------------------------|
| **inline** (baseline) | `server-inline.ts` | on the event loop, in the handler | blocks the loop → `/ping` tail latency balloons |
| **pool** | `server-pool.ts` + `cpu.worker.ts` | on the worker-pool (`fifoBackpressure`) | loop stays free → `/ping` tail latency flat |

Both expose the same endpoints:
- **`/cpu?size=N`** — the CPU-bound stand-in (the work under test).
- **`/ping`** — a cheap canary; its **p99 while `/cpu` is saturating** is the headline metric.

## Headline & metrics

The money shot is **tail latency under mixed load**, not raw throughput: with the CPU work
inline, a flood of `/cpu` **head-of-line-blocks** `/ping`; with the pool, `/ping` stays
responsive. The k6 threshold `ping_latency_ms p(99)<50` is written to **pass on the pool arm
and fail on the inline arm** — that delta is the result.

Collected per run:
- **`/cpu`** throughput (req/s) + p50/p99 latency.
- **`/ping`** p50/p99/p99.9 latency (the canary).
- **RSS per N workers** (memory cost — each worker carries its own realm/container).
- **CPU utilization** (does it actually use the cores?).

## Sweeps (each yields a finding)

- **N workers** (`BENCH_WORKERS` = 1, 2, 4, cores, cores+1) → the **scaling knee**. `N=1`
  isolates *offload* (off the loop, no extra core) from *parallelism*.
- **Payload size** (`CPU_SIZE`) → the **structured-clone crossover**: below some size the
  clone toll exceeds the parallelism win and inline wins; above it the pool wins. That
  break-even point is itself publishable.
- **Dispatch strategy** (`BENCH_DISPATCH` = `fifo-backpressure` | `round-robin`, ADR-0013)
  → shows round-robin under-reporting the pool under skewed job costs.

## Confounders to control

- **Warm-up / JIT (JSC)** — discard the ramp-up window; report the steady-state stage.
- **GC noise** — multiple runs; report the distribution, not a single number.
- **One server owns the cores** — run the arms in **separate** processes/runs (never both
  bound at once), so neither steals cores from the other during measurement.
- **Network** — host networking, not docker bridge (ADR-0007 sync-benchmark methodology),
  so the load generator isn't NAT-bottlenecked.

## Run it

```bash
# arm A — inline (one shell)
PORT=3333 bun run bench/parallelism/server-inline.ts

# arm B — pool (instead of A; one arm at a time)
PORT=3333 BENCH_WORKERS=8 bun run bench/parallelism/server-pool.ts
# dispatch comparison:
PORT=3333 BENCH_WORKERS=8 BENCH_DISPATCH=round-robin bun run bench/parallelism/server-pool.ts

# load (second shell), against whichever arm is up
k6 run -e BASE_URL=http://localhost:3333 -e CPU_SIZE=50000 bench/parallelism/load.k6.js
```

## Wiring the real jobs (EPIC-003)

1. Replace `runCpuJob` in `cpu-job.ts` with the real `statements`/`reconciliation` function
   (keep the `{ size }`-style parametrization for the sweep).
2. In `cpu.worker.ts`, `createContainer()` + bootstrap that context's deps (the worker+DI
   demo is the seed).
3. Point `/cpu` payloads at realistic shapes (statement over ~10k postings; reconcile ~50k×50k).

## The `ddd-classic` angle (qualitative, not benchmarked)

`ddd-classic` is **not** run with workers — *that is the finding*. The post pairs the number
with a code-snippet contrast of the worker boundary: DOD ships **plain data** across the
thread (`pool.run(data)`; TypedArrays transfer zero-copy), while OOP must rehydrate entities,
re-bootstrap a Nest context per worker, and **cannot send behavior** across the boundary.

## References

- ADR-0013 — pluggable dispatch strategy; `fifoBackpressure` default, `roundRobin` baseline.
- ADR-0011 — share-nothing worker-pool (`createWorkerPool`/`serveWorker`).
- examples-root `BENCHMARKS.md` §"Extra — parallelism", §"Tooling" (k6), §"Harness components".
- `packages/platform/src/worker-pool/` — the pool + strategies under test.
