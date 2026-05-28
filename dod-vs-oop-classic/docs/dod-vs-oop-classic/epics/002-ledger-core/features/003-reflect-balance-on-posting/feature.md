---
id: FEAT-003
slug: reflect-balance-on-posting
container: 002-ledger-core
mode: B
status: in-progress
depends-on: [FEAT-002]
blocks: [FEAT-006]
---

# FEAT-003 — reflect balance on posting

## Goal

Close the cross-context loop opened by FEAT-002: when the `ledger` emits
`TransactionPosted` on the synchronous in-memory bus, the `accounts` context
**reacts** — overwriting each affected account's cached `availableBalance` and
advancing a checkpoint marker of the last posting it reflects (ADR-0006). This is
the first event **consumer** in the study (FEAT-002 was the first producer) and
the first time a balance read reflects ledger activity (REQ-003 cross-context).
The cache is a recomputable optimization; the postings remain the source of truth
(NFR-DATA-001).

## Acceptance criteria

- [ ] Posting a balanced transaction updates **each affected account's** cached `availableBalance` by the sum of that account's signed postings (REQ-003: `availableBalance = Σ(posted postings) − holdAmount`; `holdAmount` is 0 until the holds feature, so `availableBalance = Σ postings`).
- [ ] The update is driven by the `TransactionPosted` domain event on the synchronous in-memory `EventBus` (ADR-0003) — `accounts` **subscribes**; the `ledger` never calls `accounts` directly.
- [ ] `GET /accounts/:id/balance` reflects posted transactions immediately after `POST /transactions` returns (in-process, synchronous).
- [ ] Each affected account's **checkpoint marker** advances to the highest posting `sequence` folded in (`throughSeq`, ADR-0006); it is **monotonic** — applying an out-of-order/stale effect throws (ADR-0002).
- [ ] An account **not** referenced by the transaction is unchanged.
- [ ] `availableBalance` stays in the account's `currency`; `version` bumps on each balance update (optimistic-lock counter).
- [ ] The `TransactionPosted` event carries each posting's `sequence` (ADR-0008); the handler advances each account's checkpoint to the max `sequence` folded in for that account.
- [ ] A thin immutable `BalanceSnapshot` VO `{ accountId, asOf, balance: Money, throughSeq }` exists with a throwing smart constructor (ADR-0002) and unit tests — **type only**; persistence + consolidation are FEAT-006.
- [ ] Unit (co-located): the new `AccountAggregate` balance-reflection method — applies a signed delta, advances the checkpoint, rejects a currency mismatch and a non-monotonic checkpoint; `BalanceSnapshot` VO spec. **Checkpoint monotonicity is covered at the unit level** — `lastPostedSeq` is internal state, not exposed over HTTP. Integration: `tests/accounts/reflect-balance.e2e.spec.ts` — open accounts, `POST` a balanced transaction, assert one balance went up and the other down by the amount, an unrelated account with a prior non-zero balance is untouched. Desync path: `tests/accounts/reflect-balance-desync.e2e.spec.ts` — when the cache update fails the producer still returns 201 (swallow-and-log).

## Scope

**In:** `accounts` context — a framework-free `OnTransactionPostedHandler`
(`EventHandler<TransactionPostedEvent>`) in `application/handlers/`; a new
controlled balance-reflection method on `AccountAggregate` (+ checkpoint field);
`UpdateAccountRepository` (segregated) + TypeORM impl with an optimistic-lock
guard; a checkpoint column on `AccountTypeOrmEntity` + mapper; EventBus
registration wired in `infrastructure/provider/` + `accounts.module.ts`. Reuse
`Money`, `Identifier`, the `EventBus` port. Framework-agnostic application
(ADR-0005). **Ledger side:** extend `TransactionPosted` + `TransactionEntry` with
the posting `sequence` and enrich the event from the persisted postings in
`PostTransactionUseCase` (ADR-0008). Land the immutable `BalanceSnapshot` VO
(type + smart constructor).

**Out:** `BalanceSnapshot` **persistence** + `ConsolidateAccountBalance` domain
service (FEAT-006, ADR-0006) — FEAT-003 lands the VO *type* only; reversal balance
effects (FEAT-004 reuses this same path); holds / `holdAmount` lifecycle (later
epic); statements/reconciliation (later epics); any Outbox/retry/dedup machinery
(ADR-0003 — the sync in-memory bus fires once).

## RPA artefacts

- `research.md` — prior art, current shapes, the handler/aggregate-method design, the checkpoint-source decision (enrich event vs reverse read), idempotency under the sync bus, ADR candidates, open questions.
- `plan.md` — file-by-file inventory + task order + test plan (after the research gate).
- `act.md` — live checklist + execution log + retro.

## Branch

`feat/reflect-balance-on-posting` off `feat/ledger-core` (the epic; FEAT-002 is merged in).

## Open questions — resolved at gate (2026-05-26)

- ✅ **Checkpoint source:** enrich `TransactionPosted` with `sequence` per entry (→ **ADR-0008**); `accounts` does not read `ledger`'s tables. (`research.md` §4.)
- ✅ **`BalanceSnapshot` VO scope:** land the thin immutable VO *type* now (honors the epic README); persistence + `ConsolidateAccountBalance` stay FEAT-006. (`research.md` §7.)
