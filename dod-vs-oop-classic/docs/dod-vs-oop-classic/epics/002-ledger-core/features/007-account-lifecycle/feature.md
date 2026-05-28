---
id: FEAT-007
slug: account-lifecycle
container: 002-ledger-core
mode: B
status: in-review
depends-on: [FEAT-001, FEAT-003]
blocks: []
---

# FEAT-007 — account lifecycle (freeze / reactivate / close)

## Goal

Give `AccountAggregate` **real behavior** (against the anemic-domain trap — see the
domain-model review on FEAT-003) and introduce the study's **first cross-aggregate
domain service**. Adds status transitions — `freeze` / `reactivate` / `close`
(REQ-012/013) — as intention-revealing aggregate methods, and gates `close` on a
balance **recomputed from the ledger** (NFR-DATA-001) via an ACL, through a
`CloseAccountService` domain service. Pulled ahead of FEAT-004/005 for didactic value:
it's where encapsulated behavior, a state machine, and a principled domain service
first appear. Extends the shared SRS (REQ-012/013); the DOD side mirrors it.

## Acceptance criteria

- [ ] `PATCH /accounts/:id/freeze` → `frozen`; `PATCH /accounts/:id/activate` → `active` (REQ-012); 200 with the updated account.
- [ ] An illegal transition throws → 422 (freeze a `closed` account; activate a non-`frozen` account; any transition out of `closed`).
- [ ] `POST /accounts/:id/closure` → `closed` **only if** the balance recomputed from the ledger postings is zero (REQ-013); a non-zero balance → 422. `closed` is terminal.
- [ ] A `frozen` or `closed` account referenced by `POST /transactions` is rejected 422 (REQ-006 gains the *active* precondition), enforced via the `AccountLookup` ACL extended with `status`.
- [ ] `close` goes through `CloseAccountService` (domain service): the **decision** (balance-from-ledger is zero) spans `accounts`+`ledger` via the `LedgerBalanceReader` ACL; the **transition** is `account.close()` on the aggregate.
- [ ] Unit (co-located): aggregate `freeze`/`activate`/`close` guards (throw on illegal transition); `CloseAccountService` (zero → closes, non-zero → throws). Integration: `tests/accounts/account-lifecycle.e2e.spec.ts` — freeze then post rejected (422); close at zero balance ok; close with non-zero balance rejected (422); post to a closed account rejected.

## Scope

**In:** `AccountAggregate.freeze()/activate()/close()` + transition guards; the
`CloseAccountService` domain service + `LedgerBalanceReader` ACL port (accounts→ledger)
+ TypeORM impl (sums signed posting cents for the account); `Freeze`/`Activate`/`Close`
use cases + named HTTP endpoints; `AccountLookup` extended with `status` and the
`PostTransactionUseCase` *active* guard (ledger side); reuse `UpdateAccountRepository`;
DI providers. Docs: SRS REQ-012/013, ADR-0010, SDD updates.

**Out:** holds-based closeability (until REQ-004/005 land — `close` checks balance only
for now); transition audit trail; reason codes; reopen (`closed → active`);
notifications.

## Branch

`feat/account-lifecycle` off `feat/ledger-core` — **after FEAT-003 merges** (this builds
on FEAT-003's `AccountAggregate` + `UpdateAccountRepository`). Design docs are committed
on `feat/reflect-balance-on-posting` (PR #3) for review alongside FEAT-003.

## RPA artefacts

- `research.md` — prior art, current state, the transition/domain-service/ACL design, ADR-0010.
- `plan.md` — file-by-file inventory + task order + test plan.
- `act.md` — created at implementation (after this design is approved).

## Open questions

- Resolved with the human (2026-05-27): extend the SRS for freeze/close; transitions are
  aggregate behaviors; `close` via a domain service that recomputes the balance from the
  ledger (ACL); `frozen`/`closed` reject postings via `AccountLookup` + `status`. Holds
  don't cross the boundary → no service for them (later feature).
