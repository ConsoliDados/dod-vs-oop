# FEAT-007 account-lifecycle — Research

RPA stage 1. Prior art, current state, options, decisions. Feeds `plan.md`.

## Sources / prior art

- **Domain-model review on FEAT-003** — the trigger. `AccountAggregate` was anemic
  (factories + getters) until `reflectPosting`; status transitions and a real domain
  service were the identified gaps. Rich behavior on the foil matters for a fair
  comparison (an anemic OOP foil understates OOP — accidental strawman).
- **FEAT-003 `reflectPosting`** — the template for a controlled mutating behavior on
  the aggregate (private fields, named method, guard, `version++`, validator re-run).
  Reuse `UpdateAccountRepository` (optimistic lock) for persisting the status change.
- **FEAT-002 `AccountLookup` ACL** — the template for a cross-context read port
  (ledger→accounts). FEAT-007 adds the **reverse** read (accounts→ledger).
- **ADR-0006 / NFR-DATA-001** — the cache is never the sole authority; balance is
  derivable from postings. This is *why* `close` recomputes from the ledger.
- **SRS** REQ-012/013 (new), REQ-006 (post rejects non-active), NFR-CORRECT-001
  (conformance — DOD mirrors). **SAD** §3–§4 (context boundaries, ports/events only).

## Current state (verified)

- `AccountAggregate.status` exists (`active | frozen | closed`) but **no transition
  method** — set to `active` at `create()`, never changed. Validator already checks the
  status value is known.
- `AccountLookup` (ledger ACL) returns `{ id, currency }` — **no `status`**.
- `PostTransactionUseCase` validates existence + currency, **not status**.
- No accounts→ledger read port; no domain service anywhere yet (`ConsolidateAccountBalance`
  is planned for FEAT-006).
- `UpdateAccountRepository` exists (FEAT-003) — reuse for the status write.

## Decisions

1. **Transitions are aggregate behaviors (state machine via guards).** `freeze()`,
   `activate()`, `close()` on `AccountAggregate`, each mutating `status` under a guard
   (throw `InvalidEntityError` on an illegal transition), `version++`, `updatedAt`.
   Legal edges: `active ⇄ frozen`; `active | frozen → closed`; `closed` is terminal.
   No setter, no generic `update()`.

2. **Closeability is a domain service — `CloseAccountService`.** The rule "close only
   if balance is zero" spans the account's state **and** the ledger-derived balance,
   which the account cannot know — so it is **not** a method of either aggregate. The
   domain service holds the rule; it receives the recomputed balance (a `Money`) and
   the account, and either calls `account.close()` or throws a closure error. **No I/O
   in the domain service** — the use case does the read via the port and feeds it in.

3. **Cross-context read — `LedgerBalanceReader` ACL port.** Declared in
   `accounts/application/ports/`, returns the account's balance summed from the ledger's
   posting history (`Money`). Implemented in `accounts/infrastructure/acl/` reading the
   ledger `postings` table read-only (the reverse of FEAT-002's `AccountLookup`; the
   single place accounts-infra touches ledger persistence). This is also the
   distribution seam of ADR-0009.

4. **`frozen`/`closed` reject postings.** Enforced at post time: `AccountLookup`'s view
   gains `status`; `PostTransactionUseCase` rejects (422) any referenced account that is
   not `active`. Keeps the rule on the producer side, reusing the existing ACL.

5. **Orchestration (framework-free, ADR-0005).** `CloseAccountUseCase` loads the account
   (`GetAccountRepository`), reads the ledger balance (`LedgerBalanceReader`), calls
   `CloseAccountService`, persists (`UpdateAccountRepository`). `FreezeAccountUseCase` /
   `ActivateAccountUseCase` are simpler: load → `account.freeze()/activate()` → persist.

## Tradeoffs considered

- **Domain service takes the port vs takes the already-read balance** — chose
  takes-the-balance: keeps the domain service pure (no I/O), the ACL read in the use
  case. Clean separation; the service is unit-testable without mocks.
- **Closeability inside `account.close()`** — rejected: the aggregate can't read the
  ledger; the rule is homeless → domain service.
- **GoF State pattern** — rejected: overkill for three states; guard clauses are
  idiomatic in this foil. (Noted in ADR-0010 as the heavy alternative.)
- **`frozen` semantics** — minimal: rejects new postings. Not modelling debit-vs-credit
  asymmetry (a frozen account blocks all postings), to avoid scope creep.

## ADR candidates

- **ADR-0010 (written): Account status lifecycle & close via a ledger-recompute domain
  service.** Captures decisions 1–4 and the SRS extension. Conformance flag: REQ-012/013
  are part of the shared contract.

## Open questions — resolved with the human (2026-05-27)

1. ✅ Extend the SRS (REQ-012/013) for freeze/close — accepted as a deliberate enrichment.
2. ✅ Transitions on the aggregate; `close` via domain service + `LedgerBalanceReader` ACL.
3. ✅ Holds don't cross the boundary → no service (separate later feature).
4. Placement: FEAT-007 under EPIC-002, pulled ahead of FEAT-004/005 (confirm at review).
