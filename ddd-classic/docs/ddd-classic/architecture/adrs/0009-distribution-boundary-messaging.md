# ADR-0009 — Distribution boundary & messaging evolution (forward-looking)

- **Status:** Accepted (forward-looking — documents a deferred path, not built)
- **Date:** 2026-05-27
- **Phase / Sprint:** EPIC-002 (ledger-core) — surfaced by FEAT-003's cross-context work

## Context

`accounts` and `ledger` are separate bounded contexts (separate modules, distinct
aggregates). They never import each other's `domain/`; cross-context contact is
narrow and explicit: `ledger` reads account currency via the `AccountLookup` ACL
port (FEAT-002), and `accounts` reacts to `ledger`'s `TransactionPosted` via the
synchronous in-memory `EventBus` (FEAT-003). No Outbox (ADR-0003).

In a real high-volume deployment these contexts would plausibly be **separate
deployables** with **asynchronous messaging** (a broker) and a **Transactional
Outbox**, driven by transaction/event load. Should the study's foil adopt that now?

## Decision

**Keep the comparison projects as a modular monolith with in-process events; do not
distribute them.** Record the distributed evolution as forward-looking architecture:

- The bounded-context seam **is already the cut line.** Going distributed is an
  **infrastructure swap** — the `EventBus` port impl (in-memory → broker + Outbox
  dispatcher/consumer) and the cross-context read (in-process ACL → remote/replicated
  read) — **not** a domain or application rewrite. This is ADR-0005 (framework- and
  infra-agnostic application) applied to the messaging axis.
- The **domain** (aggregates, invariants, events as plain data) is unchanged by
  distribution. What changes is the **operational surface**: Outbox (no event lost
  between DB commit and publish), idempotency (duplicate delivery becomes real),
  eventual consistency (the cache-desync window of ADR-0003 becomes continuous), and
  operations.
- The resilience design **already anticipates** eventual consistency: the cached
  balance is recomputable and never the sole authority (NFR-DATA-001), and the
  immutable `BalanceSnapshot` + recompute (ADR-0006) is the recovery path.

## Why not distribute now

- **Collapses a comparison axis.** ADR-0003 deliberately gives the OOP foil a sync
  in-memory bus with **no Outbox**; the DOD side uses an Outbox. Adding a broker +
  Outbox to both erases the *no-Outbox vs Outbox* contrast the study exists to show.
- **Confounds the benchmark.** The 2×2 matrix (ADR-0007) isolates *stack vs
  architecture*. A broker + network + serialization injects an I/O-dominated
  confounder unrelated to the OOP-vs-DOD axis, making the numbers uninterpretable.
- **Scope.** Outbox + broker + idempotency + two deployables + infra dwarfs the
  remaining ledger-core features — effectively a different project.

## Scope for this study

- **Implement:** nothing — this ADR documents a deferred path (like ADR-0006's
  cold/archive tiering and ADR-0004's high-precision policy).
- **Forward-looking:** if distribution is genuinely explored, it is a **separate track
  after the benchmarks** (a dedicated distributed variant), never a refactor of the
  controlled comparison.

## Alternatives considered

- **(a) Distribute now** (separate deployables + broker + Outbox) — rejected:
  collapses the ADR-0003 axis, confounds ADR-0007's benchmark, scope explosion.
- **(b) Add an Outbox to the OOP foil but keep it in-process** — rejected: still
  erases the no-Outbox contrast; the Outbox is the DOD side's distinguishing choice.
- **(c) Document the seam and defer** — chosen.

## Consequences

- **Positive:** the comparison stays controlled; the clean BC seam is an asset
  (distribution becomes a deferred, cheap-to-execute infra decision); a defensible
  narrative — pay the *modularity* cost, defer the *distribution* tax until load
  justifies it.
- **Honest caveat:** this is **not** a claim that distribution is free — only that the
  domain is insulated from it. The operational surface (Outbox, idempotency, eventual
  consistency, ops) is real work deliberately **not** done here.

## References

- ADR-0003 (sync in-memory bus, no Outbox), ADR-0005 (framework-agnostic application),
  ADR-0006 (balance cache + snapshot recompute), ADR-0007 (benchmark 2×2), ADR-0008
  (`TransactionPosted` carries `sequence`)
- `../sad.md` §3–§4 (context boundaries; only plain-data payloads + ports cross contexts)
- FEAT-002 (`AccountLookup` ACL — cross-context read), FEAT-003 (`TransactionPosted` consumer)
