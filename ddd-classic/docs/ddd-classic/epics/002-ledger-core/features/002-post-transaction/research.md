# FEAT-002 post-transaction — Research

RPA stage 1. Prior art, options, decisions. Feeds `plan.md`.

## Sources / prior art

- **FEAT-001 `accounts`** (this repo) — the established pattern stack to mirror: AggregateRoot + Validator (throw, ADR-0002), framework-free use cases taking ports (ADR-0005), segregated repos + bidirectional TypeORM mappers, DI tokens+providers under `infrastructure/provider/`, module in `infrastructure/`.
- **`src/shared/`** — reuse `Identifier`, `Money` (integer cents, ADR-0004), the `EventBus` port. Do **not** define local id/money/bus types.
- **`a real-world production ledger system`** — production reference for the verbose aggregate-with-child-entities shape and segregated repos.
- **SRS** REQ-006 (post), REQ-011 (immutability), §5.2 (transaction/posting input shape), §6 (single currency per account, append-only), glossary (Posting, Transaction, Double-entry).
- **SAD** §3 (`ledger` owns `TransactionAggregate` + `Posting`, the append-only source of truth), §4 (a context never imports another's `domain/`; cross-context contact is event payloads / ports), §5.5 (events), §6 (the post→balance dataflow).
- **ADR-0006** — balance checkpoint needs a stable ordering key (`throughSeq`) "finalized with FEAT-002's Posting".

## Decisions

1. **Aggregate boundary**: `TransactionAggregate` is the consistency boundary; `Posting` is a **non-root Entity created and validated inside the transaction** (not its own aggregate). Postings reference accounts **by id** (cross-aggregate by id, never object refs). Reads that scan postings (balance in FEAT-003, list in FEAT-005) go through a query repository, not the write aggregate.

2. **Signed-amount model (the elegant double-entry)**: each `Posting` carries a **signed `Money`** — *credit = positive*, *debit = negative* — relative to the account. The transaction is balanced ⇔ **Σ(signed amounts) == 0**, which is exactly `Σ debits == Σ credits`. An account's balance contribution is the plain sum of its postings' signed amounts (matches SRS REQ-003 `availableBalance = Σ(posted postings) − holdAmount`). The HTTP API keeps the SRS shape `{ accountId, amount (positive), direction: 'debit'|'credit' }` and the controller/mapper converts to signed at the boundary. Rationale: one number to sum, no per-account-type sign rules, trivially auditable; the credit=+ convention is documented.

3. **Invariants split (who checks what):**
   - `TransactionValidator` (intrinsic, throws `InvalidEntityError`): ≥2 postings; **balanced** (Σ signed == 0); **all postings same currency**; each posting amount non-zero; reference/metadata well-formed.
   - `PostTransactionUseCase` (cross-context, throws): every `accountId` **exists** (else `AccountNotFoundError` → 404) and **account.currency == posting.currency** (else a `CurrencyMismatchError` → 422). The aggregate can't know account existence/currency, so this lives in the use case via a port.

4. **Cross-context account validation — `AccountLookup` port (ACL)**: `ledger/application` defines `AccountLookup` returning a **ledger-local DTO** `{ id, currency, status }` (or null), so the `ledger` never imports `accounts/domain`. Implemented in `ledger/infrastructure` as an anti-corruption layer. **Tradeoff to confirm:** the impl can (a) query the `accounts` TypeORM table read-only and project to the DTO (pragmatic; couples infra layers), or (b) read a formal shared read-model. Recommendation: **(a)** for the MVP (one read, no event needed), documented as an ACL; promote to a shared read model if a second consumer appears. This keeps domain/application clean while being honest that the *infra* composes the two contexts.

5. **`TransactionPosted` event**: emitted by `PostTransactionUseCase` after persistence (pulled from the aggregate, published on the `EventBus` port). Payload = plain data: `{ transactionId, postedAt, entries: [{ accountId, amountCents, currency }] }` (signed cents). This is what `accounts` folds into its cached balance in FEAT-003. Plain-data payload per SAD §4 (no domain objects cross the bus).

6. **Posting ordering key for ADR-0006 (`throughSeq`)**: postings are immutable and append-only. For the balance checkpoint we need a **stable, monotonic, per-account order**. Decision: give each `Posting` a globally monotonic **`sequence`** (a ledger-wide auto-increment assigned at insert) plus its `postedAt`. The account-scoped checkpoint (FEAT-006) then means "postings for this account with `sequence` ≤ snapshot.throughSeq are consolidated". A global monotonic sequence is simpler than per-account counters (no per-account coordination) and still gives a total order for "postings after the checkpoint". `postedAt` stays for windowing (REQ-008/009). **So `throughSeq` = the global posting `sequence`.** Finalizes the ADR-0006 open item.

7. **Persistence**: `TransactionTypeOrmEntity` (id, reference?, metadata json, postedAt, createdAt, deletedAt) + `PostingTypeOrmEntity` (id, transactionId FK, accountId, amountCents `bigint` signed, currency, sequence, postedAt). Signed cents in `bigint` (ADR-0004). Bidirectional static mappers. `CreateTransactionRepository.insert` writes the transaction + its postings atomically (one TypeORM transaction). Postings have **no update/delete** path (REQ-011).

8. **Sequence generation**: the `sequence` is assigned at persistence (DB-side autoincrement column or a repo-managed counter), not in the domain (the domain doesn't know global order). The mapper reads it back onto the rehydrated postings. For better-sqlite3, an `INTEGER PRIMARY KEY AUTOINCREMENT`-style column or a dedicated monotonic column.

## Tradeoffs considered

- **Posting as its own aggregate vs entity-in-transaction**: chose entity-in-transaction — the double-entry invariant spans all postings of a transaction, so they must be created/validated as one unit. Independent reads use a query repo.
- **Signed amount vs `{amount, direction}` stored separately**: chose signed internally (one sum, no branching) and convert at the HTTP boundary to honor the SRS input shape. The `direction` is derivable from the sign for output.
- **`AccountLookup` ACL vs event-sourced account replica in ledger**: chose a synchronous read port (ACL) — simplest correct option for a point-in-time currency/existence check; a replica is overkill pre-benchmark.
- **Global `sequence` vs per-account sequence vs `postedAt`+id**: chose a global monotonic sequence — total order, cheap, and a clean `throughSeq` for ADR-0006 without per-account coordination.

## ADR candidates

- **None new strictly required** — the model fits ADR-0002/0003/0004/0005/0006. Two things to record (here + SDD), promote to ADRs only if they cause cross-cutting change:
  - The **signed-amount / credit-positive convention** (could be an ADR if the DOD side must match for byte-identical JSON — likely yes for the shared SRS; flag for an ADR when the conformance suite lands).
  - The **`AccountLookup` ACL** as the cross-context read mechanism (vs events for writes). Candidate ADR-0007 if a second cross-context read appears.
