# ADR-0011 — DI hardening: all-async resolve, scopes, single-flight; share-nothing worker-pool

- **Status:** Accepted
- **Date:** 2026-06-04
- **Milestone / Sprint:** EPIC-002 (active-foundation) — `feat/di-hardening` (refines ADR-0004 / FEAT-003)

> **Refined by [ADR-0013](0013-worker-pool-dispatch-strategy.md):** the worker-pool's round-robin dispatch (below) was extracted into a pluggable `DispatchStrategy`; the default is now FIFO-backpressure, with `roundRobin()` kept as a named study baseline. The share-nothing model here is unchanged.

## Context

The token container (ADR-0004) is slated to graduate into a reusable internal library (`@consolidados/di`). The question that drove this pass: is it production-ready under **Bun workers/threads**? Findings:

- The sync container was **race-free by virtue of being synchronous** (a `resolve` ran atomically — no interleave), but that capped it: **no async/lazy singletons**, **no request/task scope**, and a real **transient-`Disposable` teardown leak** (it tracked transient disposables, contradicting its own doc, growing `teardowns` unboundedly).
- **Bun workers are share-nothing**: each worker is its own thread + realm with a **separate JS heap** (only `SharedArrayBuffer` shares memory). A container is therefore **never shared across threads** — each worker builds its own. "Thread-safety" is satisfied by confinement, not locking; the real tradeoff shifts to **resources** (per-worker singletons; DB pools sized per worker), not the container.

## Decision

Harden the container and add a **separate** orchestration layer:

- **All-async "magic" `resolve`.** A factory may return `T` **or** `Promise<T>`; `resolve` awaits it, so one `register` serves sync and async providers. `resolve` returns `Promise<Result<T, DiError>>`. We accept the **microtask cost** (one tick per resolve, even cached) because the container resolves only at the composition root (ADR-0004), off the hot path. A synchronous **`peek`** returns an already-built singleton (zero microtask) for the rare hot read; `Err(NotResolved)` if unbuilt.
- **Single-flight.** Concurrent resolves of the same singleton/scoped provider share one in-flight build; a rejected build clears the entry so a later resolve can retry.
- **Async-safe cycle detection** via an **ancestor chain** threaded into the factory's injected container (not a shared mutable set, which would false-positive across concurrent chains and **deadlock** real cycles under await). A cycle returns `Err(CircularDependency)`.
- **Lifetimes** `singleton` (cached on the root, shared with every scope) | `scoped` (one per `createScope()` scope) | `transient` (fresh; **caller-owned** — never tracked). Leak fix: track only `singleton`/`scoped` disposables. `scope.dispose()` tears down only the scope.
- **Worker-pool is a separate share-nothing layer** (`platform/worker-pool`), **not** in the container — the DI must not import `Worker`/`postMessage`. Each worker bootstraps its **own** container; the pool round-robins payloads and correlates replies (`createWorkerPool` / `serveWorker`), Result-native.

## Alternatives considered

- (a) **Explicit `registerAsync` + a sync `resolve` fast path** — rejected: you cannot detect a factory as async without invoking it, so a clean hybrid needs an explicit hint; the magic (all-async + `peek`) is simpler and the cost is negligible here.
- (b) **Keep a shared mutable `resolving` set for cycle detection** — rejected: only correct while resolution is synchronous; under async it deadlocks real cycles and false-flags concurrent ones.
- (c) **Put worker orchestration inside the container** — rejected: couples the DI to a thread runtime; the share-nothing model wants each worker to own a plain container, with orchestration on top.

## Consequences

- **Positive**: production-shaped + library-grade; async/lazy providers supported; request/task isolation via scopes; share-nothing means **no cross-thread locking** to get wrong; the leak is gone.
- **Negative**: `resolve` costs one microtask per call (covered by `peek` for hot reads; nil at boot scale); **singletons are per-worker**, so shared resources (DB pools, etc.) are a worker-pool/design concern, not the container's. The base playbook's "no DI container" stance still wants softening (tracked in `PLAYBOOK-LEARNINGS.md`).

## References

- ADR-0004 — token-based DI container (amended here)
- ADR-0009 — `DiError` renderers (`NotResolved` added for `peek`)
- `packages/platform/src/di/container.ts`, `packages/platform/src/worker-pool/`
- `packages/platform/tests/container.test.ts`, `tests/worker-pool.test.ts`
