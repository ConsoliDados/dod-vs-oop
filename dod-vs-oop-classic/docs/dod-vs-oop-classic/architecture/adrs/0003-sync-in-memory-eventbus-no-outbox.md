# ADR-0003 — Synchronous in-memory EventBus (no Outbox)

- **Status:** Accepted
- **Date:** 2026-05-21
- **Phase / Sprint:** 0 (bootstrap)

## Context

Cross-context communication in this codebase happens via domain events (e.g. `ledger` emits `TransactionPosted`, `accounts` updates its cached balance). There are two well-known ways to deliver them:

- **Transactional Outbox** — persist events in the same DB transaction as the aggregate, then a relay drains and dispatches them with at-least-once semantics. Resilient, replayable, but more machinery. This is the **DOD side's** choice.
- **Synchronous in-process bus** — publish directly to in-memory subscribers after persistence. Simple, but coupled to the process and lossy on handler failure.

For the foil to contrast with the DOD side, and to match the production reference (`a real-world production ledger system` uses an in-memory `EventBus` with no Outbox), we take the synchronous route.

## Decision

We will use a **synchronous in-memory `EventBus`** with **no Outbox**. Concretely:
- An aggregate collects events via `addDomainEvent`; the use case calls `pullDomainEvents()` after persistence and publishes them.
- The bus dispatches to all registered handlers for the event type, in-process, via `Promise.all`.
- There is no persisted outbox table, no relay worker, and no replay.

## Alternatives considered

- **(a) Transactional Outbox** — rejected *for this project*: it's the DOD side's strategy; using it here would erase a key axis of the comparison. Documented as the contrast, not adopted.
- **(b) Node `EventEmitter`** — rejected: untyped and harder to test deterministically than a small typed bus we own.
- **(c) External broker (RabbitMQ/Kafka)** — rejected: out of scope; introduces infra and I/O variance that would wreck the benchmark and exceed the study's needs.

## Consequences

- **Positive**: minimal machinery; easy to follow; faithful to the production reference; the absence of an Outbox is itself a teaching point in the study ("here's what you give up").
- **Negative**: cross-context consistency is coupled to the process — if a subscriber throws *after* the DB commit, the event is lost with no automatic recovery. Acceptable for a didactic foil; explicitly **not** acceptable for billing-critical production (which is why the DOD side uses an Outbox). This fragility is the point the comparison illustrates.
- **Follow-up**: tests must cover the failure mode (handler throws → event lost) so the trade-off is demonstrated, not hidden.

## References

- `../sad.md` §5.5 — domain events
- `../srs.md` REQ-006, NFR-DATA-001 — balances derive from postings (so a lost cache-update event is recoverable by recomputation, which softens the consequence)
- `../../playbook/playbook.md` §7, anti-patterns — "no Outbox" mantra
- ADR-0001, ADR-0002 — stack and error strategy this composes with
