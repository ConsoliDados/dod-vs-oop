# ADR-0010 — Account status lifecycle & close via a ledger-recompute domain service

- **Status:** Accepted
- **Date:** 2026-05-27
- **Phase / Sprint:** EPIC-002 (ledger-core) — FEAT-007 (account-lifecycle), pulled ahead of FEAT-004/005

## Context

`AccountAggregate` carries a `status` (`active | frozen | closed`) but no transition
behavior — through FEAT-003 the field is set once at `create()` and never changes.
REQ-012/013 add **freeze/reactivate** and **close**. We must decide where the
transition logic and the closeability rule live, and how closing reads the ledger.

This is also the foil's chance to exhibit (a) **rich aggregate behavior** — an OOP
foil that is data + getters understates OOP and weakens the comparison (an accidental
strawman); and (b) the study's **first cross-aggregate domain service**.

## Decision

1. **Transitions are aggregate behaviors.** `AccountAggregate` gains `freeze()`,
   `activate()`, `close()` — intention-revealing methods that mutate `status` under
   **transition guards** (a small state machine): `active ⇄ frozen`;
   `active | frozen → closed`; `closed` is terminal. An illegal transition throws
   (ADR-0002). Behavior stays **on the aggregate** — not a setter, not a service.

2. **Closeability is a domain service — `CloseAccountService`.** Closing is
   near-irreversible, and per **NFR-DATA-001** the cached balance is never the sole
   authority. The service **recomputes the balance from the ledger's posting history**
   via an ACL read port **`LedgerBalanceReader`** (`accounts → ledger`, the reverse of
   FEAT-002's `AccountLookup`), proceeds only if it is zero (and, once holds exist, no
   open holds), then delegates the transition to `account.close()`. The **decision**
   spans `accounts` + `ledger` (service); the **transition** stays on the aggregate.

3. **Frozen/closed accounts reject postings.** Enforced at post time in `ledger`'s
   `PostTransactionUseCase`, which already reads accounts via the `AccountLookup` ACL —
   extended to carry `status`; a non-`active` referenced account → 422 (REQ-006).

## Alternatives considered

- **(a) Status via a setter / generic `update()`** — rejected: re-anemizes the
  aggregate; no intention, no guard.
- **(b) Trust the cached balance for close** — rejected: violates NFR-DATA-001 for an
  irreversible action; the cache can desync (ADR-0003).
- **(c) Closeability inside the aggregate** — rejected: it needs the ledger's posting
  sum, and an aggregate must not read another context. The decision is homeless →
  domain service + ACL.
- **(d) GoF State pattern (status as polymorphic objects)** — rejected: overkill for
  three states; guard clauses are idiomatic here. Noted as the heavier option if
  per-status behavior later diverges a lot.

## Consequences

- **Positive:** the account aggregate finally carries behavior (freeze/activate/close);
  the study gets a principled, non-contrived **domain service** (close-by-ledger-
  recompute) that reinforces the cache-vs-source-of-truth narrative (NFR-DATA-001) and
  gives the ACL a second, **reverse** instance; a clean precursor to
  `ConsolidateAccountBalance` (FEAT-006).
- **Negative / scope:** extends the shared SRS (REQ-012/013) → the DOD side must mirror
  (NFR-CORRECT-001); the `LedgerBalanceReader` ACL is a second `accounts ↔ ledger`
  infra touch; holds-based closeability is deferred until holds (REQ-004/005) exist.
- **Out (gold-plating, excluded):** transition audit trail, reason codes, reopen
  (`closed → active`), notifications — kept out so the foil stays a study, not a product.

## References

- REQ-012/013 (lifecycle), REQ-006 (post rejects non-active), NFR-DATA-001 (derivable
  balances), NFR-CORRECT-001 (conformance)
- ADR-0002 (throw), ADR-0003 (sync bus / cache desync), ADR-0005 (framework-agnostic
  application), ADR-0006 (balance cache + recompute), ADR-0008 (`TransactionPosted`
  sequence), ADR-0009 (distribution boundary — the ACL is the seam)
- FEAT-002 (`AccountLookup` ACL), FEAT-003 (`reflectPosting` — first aggregate behavior)
