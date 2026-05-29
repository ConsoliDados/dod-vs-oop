# FEAT-004 reverse-transaction — Plan

RPA stage 2. Concrete, file-by-file. Tasks flow into `act.md` as a checklist.
Design locked in `research.md` + ADR-0011 (proposed). **Code begins only
after this design is approved at the gate.**

## A. Ledger domain — reversal as a new aggregate

1. `src/ledger/domain/entities/transaction.aggregate.ts`:
   - new private field `reversedTransactionId?: string`
   - new getter `getReversedTransactionId(): string | undefined`
   - extend `TransactionSnapshot` with `reversedTransactionId?: string`
   - new **static factory** `reverseOf(original: TransactionAggregate): TransactionAggregate`
     - builds `Posting`s by negating each original posting's signed `Money`
       (`posting.getAmount().negate()`); fresh `Identifier`s; `postedAt = now`
     - fresh aggregate `Identifier`; `reference = original.reference ? "Reversal of " + original.reference : undefined`
     - `reversedTransactionId = original.getId().getValue()`
     - validator runs (balanced ✔, ≥2 ✔, single-currency ✔)
   - update the file-level doc-comment: "Corrections happen by reversal
     (FEAT-004): a new aggregate with mirrored postings linked one-way to
     the original; the original is never mutated."
2. `src/ledger/domain/validators/transaction.validator.ts` — optional new
   `validateReversedTransactionId()`: if present, must be a non-empty
   string of length 36 (uuid shape). Cheap guard; not strictly required by
   any invariant (the field is internal-only and set by `reverseOf`).
3. `src/ledger/domain/entities/transaction.aggregate.spec.ts` — extend:
   - `reverseOf` mirrors signed amounts (credit→debit, debit→credit)
   - preserves currency, account ids
   - balanced/≥2/single-currency still hold (use validator round-trip)
   - fresh aggregate id; postings have fresh ids
   - `reversedTransactionId === original.getId().getValue()`
   - reversing a reversal works (chain of length 2)

## B. Ledger application — port + error + use case

4. `src/ledger/application/repositories/get-transaction.repository.ts` — new
   port `GetTransactionRepository { findById(id: string): Promise<TransactionAggregate | null> }`.
5. `src/ledger/application/errors/transaction-not-found.error.ts` —
   `TransactionNotFoundError extends UseCaseError`, code `TRANSACTION_NOT_FOUND` → 404.
6. `src/ledger/application/usecases/reverse-transaction.usecase.ts` — new
   `ReverseTransactionUseCase` (framework-free, ADR-0005). Inputs:
   `{ id: string }` (the original's id). Output: `TransactionDto`.
   Orchestration:
     a. `original = await getTransactionRepository.findById(input.id)` → 404 if null
     b. for each `posting` of `original`: `accountLookup.findById(accountId)` →
        404 `TransactionAccountNotFoundError` if absent; 422
        `AccountNotActiveError` if status ≠ `'active'`
        (reuse FEAT-007 error to keep the shape).
     c. `reversal = TransactionAggregate.reverseOf(original)`
     d. `persisted = await createTransactionRepository.insert(reversal)`
     e. `await eventBus.publishAll([new TransactionPostedEvent(persisted.getId().getValue(), persisted.getPostedAt(), persisted.toEntries())])`
     f. return `TransactionUseCaseMapper.toDto(persisted)`

## C. Ledger infrastructure — persistence column + mapper + repo + http

7. `src/ledger/infrastructure/typeorm/entities/transaction.typeorm.entity.ts` —
   add nullable column `reversedTransactionId: string | null` (`VARCHAR(36)`,
   nullable). No index in v1 (the only consumer is a query we don't ship yet).
8. `src/ledger/infrastructure/typeorm/mappers/transaction.typeorm.mapper.ts` —
   round-trip the new column (`entity.reversedTransactionId = transaction.getReversedTransactionId() ?? null` /
   `reversedTransactionId: transaction.reversedTransactionId ?? undefined`).
9. `src/ledger/infrastructure/typeorm/repositories/get-transaction.typeorm.repository.ts` —
   new repo: load transaction row + postings (`ORDER BY sequence ASC`),
   delegate to the mapper. Returns null if absent or soft-deleted.
10. `src/ledger/infrastructure/provider/repositories/get-transaction.provider.ts` —
    Symbol token + `useClass`.
11. `src/ledger/infrastructure/provider/usecases/reverse-transaction.provider.ts` —
    Symbol token + `useFactory` injecting the new repo + the existing
    `CreateTransactionRepository` + `AccountLookup` + `EventBus`.
12. `src/ledger/application/mappers/transaction.usecase.mapper.ts` — add
    `reversedTransactionId?: string` to `TransactionDto` and project it from
    the aggregate.
13. `src/ledger/infrastructure/http/dtos/post-transaction.dto.ts` —
    nothing to change (input shape stays the same for POST). No DTO file
    for the reversal — the URL carries the id; no body.
14. `src/ledger/infrastructure/http/controllers/transaction.controller.ts` —
    `@Post(':id/reversals') @HttpCode(201) reverse(@Param('id') id) → TransactionDto`.
15. `src/ledger/infrastructure/ledger.module.ts` — register the new providers.

## D. Tests

16. `transaction.aggregate.spec.ts` — extended (see A.3).
17. `tests/ledger/reverse-transaction.e2e.spec.ts` (new):
    - happy path: open 2 accounts, post 1000 BRL, reverse → 201 with the
      mirror; cached balances back to zero; original row + postings
      unchanged (assert via GET DB sanity? Or via `GET /transactions/:id`?
      We don't ship `GET /transactions/:id` here; assert via the balances
      and the reversal's `reversedTransactionId`).
    - 404 on unknown id
    - 422 if any referenced account is frozen
      (`PATCH /accounts/:id/freeze` first, then reverse → expect
      `ACCOUNT_NOT_ACTIVE`)
    - reverse-of-a-reversal: post → reverse → reverse — third tx is a
      "re-do" of the original; balances match the first post; chain of
      `reversedTransactionId`s readable on the DTOs.
    - the existing `reflect-balance` and `post-transaction` e2es stay green
      (those scenarios are unaffected).
18. `pnpm check` + `pnpm test` green after each phase.

## E. Docs (DoD)

19. `architecture/sdds/sdd-ledger.md`:
    - §2 add `TransactionAggregate.reverseOf` + the `reversedTransactionId`
      field; note "deliberately behavior-light for state mutation" still
      holds — `reverseOf` is a factory, not a mutator.
    - §3 add the `ReverseTransactionUseCase` row + HTTP route.
    - §5 add `TransactionNotFoundError` row.
    - §6 add the `GetTransactionRepository` segregated port.
    - §7 flip "Reverse a transaction" from planned to ✅ FEAT-004.
20. `architecture/adrs/0011-reversal-as-new-aggregate.md` (new) — captures:
    decision (reversal = new aggregate; link one-way on the reversal; flows
    through `TransactionPosted`); alternatives (denormalize `reversedBy`;
    special subtype; aggregate method instead of factory); consequences;
    references to REQ-007/011, ADR-0008, ADR-0010.
21. `epics/002-ledger-core/README.md` — REQ-007 exit checked; progress log
    entry.
22. `features/004-reverse-transaction/act.md` — execution log + retro (at
    implementation).

## Task order

A (aggregate + spec) → B (port + error + use case) → C (entity column +
mapper + repo + provider + DTO field + controller + module) → D (e2e) →
E (SDD + ADR + epic + act). Gate per layer: `pnpm check`. Final: `pnpm
test` green (target 91+, was 83).

## Test plan → acceptance mapping

| feature.md criterion | covered by |
|---|---|
| 201 with mirrored postings | aggregate spec + e2e happy |
| `reversedTransactionId` set; original unchanged | aggregate spec + e2e (balances + link) |
| unknown id → 404 | e2e |
| non-active → 422 | e2e (freeze first) |
| balances flatten via `TransactionPosted` | e2e |
| reverse-of-a-reversal as a re-do | aggregate spec + e2e |
| no idempotency key today | documented; e2e shows two reversals coexist |

## Risks / notes

- **Cross-aggregate read inside `ledger`** — `GetTransactionRepository` reads
  *its own* aggregate; no new cross-context coupling.
- **`AccountLookup` active guard duplicated** — `PostTransactionUseCase` and
  `ReverseTransactionUseCase` share the per-posting loop. Considered
  factoring into a `resolveAccounts(...)` helper; deferred — duplication is
  shallow, and DRY-ing prematurely would obscure the per-use-case error
  semantics. Revisit if FEAT-005's list path grows similar checks.
- **`reversedTransactionId` index** — not indexed in v1; if FEAT-005 or a
  later "reversals of a transaction" endpoint lands, add the index then.
- **Event semantics** — the reversal's `TransactionPosted` carries
  **negated** signed cents per posting; the existing `reflectPosting` path
  applies them as-is (a credit-mirror is a debit delta). No new code in
  `accounts`. Asserted explicitly in the e2e.
- **The `reflect-balance.e2e` invariant** — that "an unrelated account is
  untouched" survives the new test: a reversal of a tx that doesn't touch
  account X leaves X alone.
