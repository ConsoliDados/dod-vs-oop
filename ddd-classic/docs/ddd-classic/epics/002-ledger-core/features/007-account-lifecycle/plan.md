# FEAT-007 account-lifecycle — Plan

RPA stage 2. Concrete, file-by-file. Tasks flow into `act.md` as a checklist.
Design locked in `research.md` + ADR-0010. **Code begins only after this design is
approved** (reviewed alongside FEAT-003 on PR #3).

## A. Accounts domain — transitions as behavior

1. `src/accounts/domain/entities/account.aggregate.ts`:
   - `freeze()` — guard: status must be `active` (else throw `InvalidEntityError`); → `frozen`; `version++`; `updateUpdatedAt()`; re-validate.
   - `activate()` — guard: status must be `frozen`; → `active`; `version++`; touch; re-validate.
   - `close()` — guard: status must not be `closed`; → `closed`; `version++`; touch; re-validate. (The *zero-balance* precondition is **not** here — it needs the ledger; it's the domain service's job.)
   - Optional: a private `assertTransition(from[], to)` helper to keep guards uniform.
2. `account.validator.ts` — no new field; status value already validated. (Transition legality is a behavior guard, not a structural invariant.)

## B. Accounts domain service + ports

3. `src/accounts/domain/services/close-account.service.ts` — `CloseAccountService` (extends the `core` domain-service marker). Method `close(account: AccountAggregate, ledgerBalance: Money): void` — if `!ledgerBalance.isZero()` throw `AccountNotClosableError`; else `account.close()`. **Pure, no I/O.**
4. `src/accounts/application/ports/ledger-balance-reader.port.ts` — `LedgerBalanceReader { balanceOf(accountId: string): Promise<Money> }` (ACL accounts→ledger; sums signed posting cents).
5. `src/accounts/application/errors/account-not-closable.error.ts` — `AccountNotClosableError extends UseCaseError` (code `ACCOUNT_NOT_CLOSABLE`) → 422. (Transition guards throw `InvalidEntityError` → 422 via the filter.)

## C. Accounts application — use cases

6. `freeze-account.usecase.ts` / `activate-account.usecase.ts` — load (`GetAccountRepository`, 404 if absent) → `account.freeze()/activate()` → `UpdateAccountRepository.update` → DTO.
7. `close-account.usecase.ts` — load → `ledgerBalance = LedgerBalanceReader.balanceOf(id)` → `CloseAccountService.close(account, ledgerBalance)` → `UpdateAccountRepository.update` → DTO.

## D. Ledger side — status-aware ACL + post guard

8. `src/ledger/application/ports/account-lookup.port.ts` — `AccountView` gains `status: AccountStatus` (string union mirrored locally — no `accounts/domain` import).
9. `src/ledger/infrastructure/acl/account-lookup.typeorm.ts` — project `status` from the accounts row.
10. `src/ledger/application/usecases/post-transaction.usecase.ts` — after existence/currency, reject (422) any referenced account whose `status !== 'active'` (new `AccountNotActiveError` → 422, or reuse the validation error shape). Updates REQ-006.

## E. Accounts infrastructure

11. `src/accounts/infrastructure/acl/ledger-balance-reader.typeorm.ts` — reads the ledger `postings` table read-only, `SUM(amountCents)` for `accountId` → `Money` (account currency via the row / a lookup). Single accounts→ledger infra touch.
12. `src/accounts/infrastructure/http/controllers/account.controller.ts` — add `PATCH /accounts/:id/freeze`, `PATCH /accounts/:id/activate`, `POST /accounts/:id/closure` (named behavior endpoints; 200 with account DTO).
13. `src/accounts/infrastructure/provider/` — providers for the 3 use cases + `CloseAccountService` + `LedgerBalanceReader` (Symbol tokens, `useFactory`/`useClass`).
14. `src/accounts/infrastructure/accounts.module.ts` — register the new providers; import the ledger `PostingTypeOrmEntity` into `forFeature` for the ACL read (mirrors how ledger imports the accounts entity).

## F. Tests

15. `account.aggregate.spec.ts` (extend) — `freeze`/`activate`/`close` happy + illegal-transition throws (freeze a closed, activate an active, transition out of closed).
16. `close-account.service.spec.ts` (new) — zero balance → `close()`; non-zero → throws `AccountNotClosableError`.
17. `tests/accounts/account-lifecycle.e2e.spec.ts` (new) — freeze → `POST /transactions` referencing it returns 422; `POST /accounts/:id/closure` at zero balance → 200 `closed`; post a balanced tx, then `closure` → 422 (non-zero); post to a `closed` account → 422.

## G. Docs (DoD)

18. SRS REQ-012/013 + REQ-006 *active* — **done**. ADR-0010 — **done**.
19. `sdd-accounts.md` — status transitions behaviors, `CloseAccountService`, `LedgerBalanceReader` port, the 3 use cases.
20. `sdd-ledger.md` — `AccountLookup` gains `status`; `PostTransactionUseCase` rejects non-active.
21. `epics/002-ledger-core/README.md` — add FEAT-007 to the table + sequence (ahead of 004/005) + exits; progress log.
22. `act.md` — live checklist + execution log + retro (at implementation).

## Task order

A (transitions + guards + specs) → B (domain service + ports + error) → C (use cases) →
D (ledger ACL + post guard) → E (infra: ACL read, controller, providers, module) →
F (e2e) → G (SDD/epic). Gate per layer: `pnpm check`. Final: `pnpm test` green.

## Test plan → acceptance mapping

| feature.md criterion | covered by |
|---|---|
| freeze/activate transitions (REQ-012) | aggregate spec + e2e |
| illegal transition → 422 | aggregate spec |
| close only at zero balance (REQ-013) | close-account.service spec + e2e |
| frozen/closed rejected when posting (REQ-006) | e2e (post → 422) |
| close via domain service + ACL recompute | service spec; e2e proves end-to-end |

## Risks / notes

- **Touches FEAT-002/003 (ledger + accounts).** `AccountLookup` payload widens (+`status`)
  and `PostTransactionUseCase` gains a guard — keep `post-transaction.e2e` green (its
  accounts are `active`, so unaffected).
- **`LedgerBalanceReader` currency:** the sum needs the account currency; read it from the
  account (already loaded in the use case) and build `Money` in that currency, or have the
  reader return cents + the use case wrap. Decide in `act` (lean: use case passes currency).
- **Stacks on FEAT-003** (uses `UpdateAccountRepository` + the post-FEAT-003 aggregate) →
  branch after PR #3 merges to avoid the FEAT-002-style stacking pain.
