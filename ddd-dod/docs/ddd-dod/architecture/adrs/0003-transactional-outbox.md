# ADR-0003 — Transactional Outbox for cross-context messaging

- **Status:** Accepted
- **Date:** 2026-06-03
- **Phase / Sprint:** 0 (bootstrap)

## Context

Cross-context reactions (e.g. `accounts` reflecting balance from `ledger`'s `TransactionPosted`) need a delivery mechanism. `ddd-classic` uses a **synchronous in-memory EventBus, no outbox** (its ADR-0003). `ddd-dod` is the counterpart that demonstrates **side-effect as data** (SAD pattern #5/#7): the domain returns events; the use case persists them atomically with the state change.

## Decision

Use a **Transactional Outbox**. The repository's `saveWithEvents(state, events)` persists the aggregate state **and** inserts the event rows into an `outbox` table **in the same transaction**. A separate **dispatcher** drains `outbox WHERE status = 'pending'`, delivers each event to the consuming context's handler, and marks it `processed`. Handlers are **idempotent by `event_id`**. Events are versioned (`v: 1`) and live as published contracts in `shared-kernel`.

## Alternatives considered

- **(a) Synchronous in-memory EventBus (the `ddd-classic` approach)** — rejected here by definition; it is the other side of the study, and it cannot demonstrate at-least-once delivery with atomic persistence.
- **(b) Emit-then-publish without a transaction** — rejected: the classic dual-write hazard (state committed, event lost on crash); the outbox exists precisely to remove it.
- **(c) External broker (Kafka/NATS)** — rejected: out of scope for an in-process study; would add infra variance to benchmarks.

## Consequences

- **Positive**: no lost events; atomic state+event; idempotent replay; faithful DOD demonstration of side-effect-as-data.
- **Negative**: eventual (not synchronous) consistency for the cached balance — the conformance suite and tests must account for dispatcher draining. Mitigated by draining synchronously in tests and exposing a deterministic drain hook.
- **Follow-up**: the `platform` package hosts the outbox table schema + dispatcher runtime; the event contracts live in `shared-kernel`.

## References

- `../sad.md` §2 (#5, #7), §5, §6 — side-effect-as-data and the post-transaction dataflow
- `ddd-classic` ADR-0003 — the synchronous EventBus counterpart
- memory `feedback_swallow_and_log_recomputable_cache` — handler resilience for recomputable caches
