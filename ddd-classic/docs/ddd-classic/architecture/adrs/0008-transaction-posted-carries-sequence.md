# ADR-0008 — `TransactionPosted` carries the posting `sequence` per entry

- **Status:** Accepted
- **Date:** 2026-05-26
- **Phase / Sprint:** EPIC-002 (ledger-core) — FEAT-003 (reflect-balance-on-posting)

## Context

FEAT-003 has the `accounts` context react to `TransactionPosted` (on the synchronous
in-memory bus, ADR-0003): overwrite each affected account's cached `availableBalance`
and advance a checkpoint marker — the `throughSeq` of ADR-0006, finalized in FEAT-002
as the **global posting `sequence`** (a DB-assigned monotonic auto-increment).

The balance delta is computable from the event alone (`Σ` of the entry's signed
`amountCents`). Advancing `throughSeq`, however, needs the per-account posting
`sequence`. The FEAT-002 payload — `{ accountId, amountCents, currency }` — does not
carry it, and `sequence` only exists **after** persistence, whereas the domain event
is emitted by `TransactionAggregate.create()` **before** the postings are saved.

Two ways to get the `sequence` to the `accounts` handler:
- the consumer reads the producer's `postings` table (a reverse ACL), or
- the event carries it.

## Decision

**The `TransactionPosted` payload carries `sequence` per entry.** `TransactionEntry`
becomes `{ accountId, amountCents, currency, sequence }`. Because `sequence` is
assigned at persistence, **`PostTransactionUseCase` builds the published event from
the persisted postings** (the repository returns the rehydrated aggregate whose
postings carry their DB `sequence`) rather than from the `create()`-time event.

Rationale: domain events are the cross-context **write-direction contract** (SAD §4 —
only plain data crosses the bus); a consumer must be self-sufficient from the payload
and must not reach into the producer's tables. Carrying `sequence` avoids a reverse
`accounts → ledger` coupling and an extra read per event.

## Alternatives considered

- **(a) Reverse read port** (`accounts` ACL into the `ledger` `postings` table) —
  rejected: a second cross-context infra coupling plus a read per event; the event
  already crosses the boundary, so put the data on it.
- **(b) Keep the `create()`-time event and attach `sequence` later by mutation** —
  rejected: the event should be published as a faithful record; building it from
  persisted state is cleaner than mutating a pulled event.
- **(c) Per-account checkpoint via `postedAt`+`id`** — rejected in FEAT-002
  (`throughSeq` = global `sequence`); timestamps are not a total order.

## Consequences

- **Positive:** `accounts` stays decoupled from `ledger` persistence; the event is a
  complete record (amounts + ordering); FEAT-006 consolidation reuses the same
  `throughSeq`.
- **Negative:** the event is now assembled **post-persistence** in the use case (a
  small shift from "publish the aggregate's pulled events verbatim"); the payload is
  wider.
- **Shared contract:** the payload is part of the shared SRS — the `ddd-dod`
  side must emit the same shape (NFR-CORRECT-001, byte-identical JSON). **Flag for the
  conformance suite.**
- **Supersedes** the FEAT-002 research note fixing the payload at
  `{ accountId, amountCents, currency }` — extends it with `sequence`.

## References

- ADR-0006 (balance cache + `throughSeq`), ADR-0003 (sync in-memory bus), ADR-0002 (throw)
- FEAT-002 `research.md` §5/§6 (event payload + global `sequence`); FEAT-003 `research.md` §4
- `../srs.md` NFR-CORRECT-001 (conformance), REQ-003 (available balance)
