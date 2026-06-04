# ADR-0013 — Worker-pool dispatch: pluggable strategy, FIFO-backpressure default

- **Status:** Accepted
- **Date:** 2026-06-04
- **Milestone / Sprint:** EPIC-002 (active-foundation) — `feat/worker-pool-dispatch` (refines ADR-0011)

## Context

ADR-0011 shipped the share-nothing worker-pool with a **round-robin** dispatch: task *k* goes to worker *k mod size*, unbounded in-flight, no regard for worker load. That was fine as a seed but has two problems as we move toward the **Phase-3 parallelism axis** (`ddd-dod` inline vs `ddd-dod` + thread-workers):

- **Round-robin lies under skewed load.** The pool's jobs are CPU-bound (`statements`, `reconciliation`) with **uneven cost** — a big batch next to a small one. Round-robin can queue the next request *behind* a heavy job on one worker while a sibling sits idle, inflating tail latency. Benchmarking the worker arm with this dispatch would **under-report** its real win — a measurement-hygiene defect, not just a perf one.
- **Two CPU jobs on one worker don't parallelize.** A worker is a single thread; a second concurrent job just interleaves on that worker's event loop, adding latency to both. Unbounded in-flight per worker is the wrong shape for CPU-saturating work.

The pool is also slated to graduate into a reusable internal lib (`@consolidados/*`, alongside DI + logger). And the **study itself wants to compare dispatch policies** (naive round-robin vs backpressured) — so the dispatch policy is a first-class variable, not an internal detail to hardcode.

## Decision

Extract dispatch into a **pluggable `DispatchStrategy` seam**, with the pool keeping ownership of transport.

- **Separation of concerns.** The **pool** owns the transport — spawn, `postMessage`, reply correlation by id, worker-crash handling, dispose. The **strategy** owns *which worker, when*. The strategy is injected a minimal `DispatchContext` (`size` + `send(index, payload): Promise<Result>`) and **never** touches `Worker`/`postMessage` — so scheduling policy is independent of the thread runtime and unit-testable against a fake transport.
- **`fifoBackpressure()` is the default** — **at most one in-flight job per worker** (a second would only serialize on that worker's loop), surplus tasks held in a **FIFO queue**, pulled as workers free up. This is the correct policy for CPU-bound jobs and our production case. `drain()` (on dispose) settles still-**queued** tasks as `Err(PoolDisposed)`; in-flight tasks are settled by the pool's existing terminate loop.
- **`roundRobin()` is kept as a named strategy**, not deleted — it is the naive **baseline** the study measures `fifoBackpressure` against (and the qualitative "round-robin lies" angle). Unbounded in-flight, never queues, `drain` is a no-op.
- **Open for extension.** A new policy (e.g. `leastLoaded()` for partly-async worker tasks) implements the same interface without touching the pool. The default keeps the public API additive: existing `createWorkerPool({ size, worker })` calls now get FIFO-backpressure for free.

## Alternatives considered

- (a) **Amend ADR-0011 in place** instead of a new ADR — rejected: ADRs are a dated decision log; editing 0011 to say "FIFO" erases that round-robin came first and *why* it changed. Follows the house precedent (ADR-0011 refined ADR-0004 via a new ADR, not an in-place edit).
- (b) **String-enum strategy** (`strategy: 'fifo' | 'round-robin'`) — rejected: centralizes every policy in one `switch`, less extensible, and demotes round-robin to "the old mode" rather than a first-class study baseline. Passing the strategy object is more lib-grade.
- (c) **Hardcode FIFO now, extract the seam when a second case appears** (YAGNI) — rejected: the second case already exists (round-robin, kept as baseline) and the **study's whole point** is to compare policies, so pluggability is a requirement here, not speculation.
- (d) **Least-loaded (allow N in-flight, pick the least-busy worker)** as the default — deferred, not rejected: correct when worker tasks have internal I/O/async, but our jobs are CPU-saturating, where strict 1-in-flight is more correct. Ships later as another strategy.

## Consequences

- **Positive**: fair benchmarks (no round-robin handicap on the worker arm); dispatch policy is a first-class, swappable study variable; correct backpressure for CPU jobs; lib-grade seam toward `@consolidados/*`; additive API (the default upgrades existing callers).
- **Negative**: one more concept (strategy) in the pool's surface; the FIFO queue is unbounded (no max-depth / shed-load yet — acceptable for a didactic bench, flagged for the lib). `leastLoaded` is a TODO for I/O-flavored worker tasks.
- **Scope**: the strategy seam + `roundRobin`/`fifoBackpressure` land here in `platform/worker-pool`. Wiring a CPU-bound context (`statements`/`reconciliation`) onto the pool, and the inline-vs-pool benchmark itself, land with the **Phase-3 axis** (post EPIC-003, which delivers the real domain jobs).

## References

- ADR-0011 — DI hardening + share-nothing worker-pool (round-robin; **refined here**)
- ADR-0008/0009 — error shape / renderers (`WorkerPoolError`)
- `packages/platform/src/worker-pool/dispatch.ts` — `DispatchStrategy`, `roundRobin`, `fifoBackpressure`
- `packages/platform/src/worker-pool/dispatch.test.ts` — strategy invariants (fake transport)
- `packages/platform/src/worker-pool/worker-pool.ts` — transport + seam wiring
- Phase-3 parallelism axis — examples-root `BENCHMARKS.md` "Extra — parallelism"; `STUDY-ROADMAP.md` Phase 3
