# FEAT-003 reflect-balance-on-posting — Research

RPA stage 1. Prior art, current shapes, options, decisions. Feeds `plan.md`.

## Sources / prior art

- **FEAT-001 / FEAT-002** (this repo) — the established stack to mirror: framework-free application classes taking ports (ADR-0005), segregated repos + bidirectional TypeORM mappers, DI tokens+providers under `infrastructure/provider/`, module in `infrastructure/`, throw on first violation (ADR-0002). FEAT-002 finalized the **signed-amount model** (credit +, debit −), the **`TransactionPosted` payload**, and **`throughSeq` = the global posting `sequence`**.
- **`src/shared/`** — reuse `Money` (signed integer cents, ADR-0004), `Identifier`, and the `EventBus` port. The bus already exposes `register(eventType, handler)` + `publish/publishAll` and dispatches **synchronously** (no Outbox, ADR-0003).
- **a real-world production ledger system** — production reference for the verbose subscriber/handler + segregated-repo shape.
- **ADR-0006** — balance is a recomputable **cache** (overwritten per `TransactionPosted`, carrying a checkpoint marker) + an immutable append-only **`BalanceSnapshot`**; *the cache overwrites, the snapshot appends*; current = latest snapshot + Σ(postings after `throughSeq`). FEAT-003 owns the **cache + checkpoint**; consolidation/persistence is FEAT-006.
- **ADR-0003** — synchronous in-memory bus, no Outbox; the cross-context cache update is coupled to the post transaction in-process.
- **SRS** REQ-003 (`availableBalance = Σ(posted postings) − holdAmount`), NFR-DATA-001 (balances are derivable; the cache is never the sole authority). **SAD** §3 (accounts owns balance), §5.5 (events trigger the cache update).
- **sdd-accounts** §2 (balance model), §7 (open item: "event-driven `availableBalance` cache overwrite + checkpoint advance on `TransactionPosted` — FEAT-003").

## Current state (verified against code)

- **`AccountAggregate`** — has `availableBalance: Money`, `holdAmount: Money`, `version`, `currency`, `status`; `create()`/`buildExisting(snapshot)`; getters. **No balance-mutation method and no checkpoint field** → both must be added.
- **`AccountValidator`** — enforces currency match (`availableBalance`/`holdAmount` vs account `currency`), `holdAmount ≥ 0`, `version` non-negative integer. Re-runs in the constructor.
- **`EventBus`** — `register<E>(eventType: string, handler: EventHandler<E>)`, `publish`, `publishAll`. `InMemoryEventBus` keeps `Map<eventType, EventHandler[]>` and dispatches via `Promise.all` synchronously; `@Global() SharedModule`, token `EVENT_BUS`. **No `accounts` subscriber exists today.**
- **`TransactionPostedEvent`** — `EVENT_TYPE = 'TransactionPosted'`; `{ aggregateId (txId), postedAt: Date, entries: { accountId, amountCents (signed), currency }[] }`. **No posting `sequence` on the payload.**
- **`Posting.sequence`** — DB `@PrimaryGeneratedColumn()` (global monotonic), assigned at insert, present on the rehydrated domain `Posting`, **not** propagated to the event.
- **Account repos** — `CreateAccountRepository` + `GetAccountRepository` exist. **No `UpdateAccountRepository`** → must add.
- **`AccountTypeOrmEntity` + mapper** — columns for balances/version; **no checkpoint column** → must add.

## Decisions

1. **Handler placement (ADR-0005).** The subscriber is a framework-free application class `OnTransactionPostedHandler implements EventHandler<TransactionPostedEvent>` in `accounts/application/handlers/`, constructor takes ports (`GetAccountRepository`, `UpdateAccountRepository`). Registering it with the bus (`eventBus.register('TransactionPosted', handler)`) is **infra wiring** in `accounts/infrastructure/provider/` + module init — never a framework decorator on the handler. Mirrors how use cases are wired.

2. **Balance update semantics.** Per event: group `entries` by `accountId`; for each affected account — load via `GetAccountRepository` → apply the **net signed Σ(amountCents)** of its entries → persist via `UpdateAccountRepository`. New cached `availableBalance = old + Σ(entry.amountCents)` in the account's currency (REQ-003; `holdAmount = 0` until the holds feature, so available = Σ postings). One load+save per account even if it appears in several entries of the same transaction.

3. **New aggregate method (controlled mutation, throw).** `reflectPosting(delta: Money, throughSeq: number): void` (name TBD in plan) — adds `delta` to `availableBalance` (currency-checked via the validator), sets the checkpoint to `throughSeq` (**must be strictly greater** than the current marker — monotonic; throws `InvalidEntityError`/domain error otherwise), bumps `version`, touches `updatedAt`. Mutation stays **inside** the aggregate (no external setter); the validator re-runs so an invalid state can't result.

4. **Checkpoint source — the key open decision (ADR candidate).** The event carries amounts but not the posting `sequence`. The balance delta works from the event alone; advancing `throughSeq` needs the per-account max `sequence`. Options:
   - **(A) Enrich the event** — add `sequence` to each `TransactionEntry`, filled **after persistence** (the `PostTransactionUseCase` publishes post-insert and has the saved postings with their DB sequences). The consumer is self-sufficient; `accounts` never reaches into `ledger`'s tables. Cost: the event is emitted by `aggregate.create()` *before* sequences exist, so the use case must **enrich/replace** the event after persistence (documented orchestration).
   - **(B) Reverse read port** — `PostingSequenceLookup` in `accounts/infrastructure` (ACL into the ledger `postings` table), symmetric to FEAT-002's `AccountLookup`. Cost: a second cross-context infra coupling + an extra read per event.
   - **Recommendation: (A).** The event is the contract for the *write* direction (SAD §4: only plain-data payloads cross the bus); carrying `sequence` keeps `accounts` from coupling to `ledger`'s persistence and matches "events carry what consumers need." This **extends the FEAT-002 payload** (`{accountId, amountCents, currency}` → `+ sequence`) and touches the shared SRS/DOD contract → record as **ADR-0008** and flag for the conformance suite.
   - **✅ Resolved at gate (2026-05-26): (A) — enrich the event.** ADR-0008 written. The `PostTransactionUseCase` builds the enriched `TransactionPosted` from the **persisted** postings (which carry the DB `sequence`), not the `create()`-time event.

5. **Idempotency.** The sync in-memory bus (ADR-0003) fires **once, in-process, post-persistence** → no duplicate-delivery risk in the foil. The monotonic `throughSeq` guard (decision 3) is still implemented — it is cheap correctness and is the same guard FEAT-006 consolidation relies on — but we build **no** dedup/Outbox machinery.

6. **`UpdateAccountRepository` (segregated, CQRS-style).** `update(account: AccountAggregate): Promise<void>` — interface in `application/repositories/`, TypeORM impl writing `availableBalanceCents`, `version`, the checkpoint, and `updatedAt`, **guarded by the prior `version`** (optimistic lock; a stale write throws). New nullable checkpoint column `lastPostedSeq` (0/absent = nothing folded yet) on `AccountTypeOrmEntity` + mapper round-trip.

7. **`BalanceSnapshot` VO scope.** The epic README says FEAT-003 "lands the immutable `BalanceSnapshot` VO"; ADR-0006 §Follow-up and `sdd-accounts` §7 put the VO **and** its persistence in FEAT-006. **✅ Resolved at gate (2026-05-26): land a thin `BalanceSnapshot` VO now** (honors the epic README), with **no persistence and no `ConsolidateAccountBalance`** — those stay FEAT-006. The VO is the immutable type `{ accountId, asOf, balance: Money, throughSeq }` with a smart constructor that throws on invalid input (ADR-0002); it is unit-tested but not yet written by any repository in this slice.

8. **Failure semantics (ADR-0003 tradeoff).** If the handler throws after the transaction persisted, the posting stays (source of truth) and the cache desyncs — recoverable by recompute (NFR-DATA-001); the immutable posting trail is untouched. Tests cover the happy path; the desync is the documented tradeoff (epic risk note). No compensation/rollback in the sync foil.

## Tradeoffs considered

- **Enrich event (A) vs reverse read port (B)** — chose (A): keeps `accounts` from reaching into `ledger`'s tables; the event is the write-direction contract. (B) stays viable if we later refuse to grow the payload.
- **Aggregate method vs external balance setter** — chose a controlled method inside the aggregate (throw-based, monotonic checkpoint, version bump) over exposing a setter, per the verbose-canonical style.
- **Land `BalanceSnapshot` now vs FEAT-006** — lean: defer to where it is used.
- **Net vs per-entry update when an account appears twice in one transaction** — sum the net once → one load/save per account per event (fewer optimistic-lock collisions, same result).

## ADR candidates

- **ADR-0008 (write it): `TransactionPosted` payload carries posting `sequence` per entry.** Lets `accounts` advance `throughSeq` without reading `ledger`'s tables; changes the shared event/SRS contract, so the `dod-vs-oop-dod` side must match (NFR-CORRECT-001 byte-identical JSON). **Confirmed at gate** → authored alongside `plan.md`.

## Open questions — resolved at gate (2026-05-26)

1. ✅ Checkpoint source: **4(A) enrich the event** with `sequence` (→ ADR-0008).
2. ✅ `BalanceSnapshot` VO: **land a thin VO now** (decision 7); persistence + `ConsolidateAccountBalance` stay FEAT-006.
