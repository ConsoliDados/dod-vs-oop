# FEAT-004 reverse-transaction — Act

RPA stage 3. Live task tracker (pulled from `plan.md`) + execution log + retro.

## Tasks

### A. Ledger domain — reversal as a new aggregate
- [x] `transaction.aggregate.ts` — new optional field `reversedTransactionId?: string`; new getter; extended `TransactionSnapshot`; static factory `reverseOf(original)`; updated file-level doc-comment to point at ADR-0011
- [x] `transaction.validator.ts` — new `validateReversedTransactionId` (cheap uuid-shape guard against a corrupt persisted value)
- [x] `transaction.aggregate.spec.ts` — 6 new `reverseOf` cases (per-posting sign flip; link captured; fresh ids; reference prefix vs undefined; reverse-of-reversal; 3-posting mirror)

### B. Ledger application — port + error + use case
- [x] `get-transaction.repository.ts` — segregated port `findById(id) → Promise<TransactionAggregate | null>`
- [x] `transaction-not-found.error.ts` — UseCaseError code `TRANSACTION_NOT_FOUND` → 404
- [x] `reverse-transaction.usecase.ts` — load → per-posting `AccountLookup` *active* guard (reuses `TransactionAccountNotFoundError` + `AccountNotActiveError`) → `reverseOf` → atomic insert → publish `TransactionPosted` (ADR-0008)

### C. Ledger infrastructure
- [x] `transaction.typeorm.entity.ts` — nullable column `reversedTransactionId VARCHAR(36)`
- [x] `transaction.typeorm.mapper.ts` — round-trip the new column (both directions)
- [x] `get-transaction.typeorm.repository.ts` — load tx row + postings (`ORDER BY sequence ASC`), delegate to the mapper, filter soft-deleted
- [x] `get-transaction.provider.ts` — Symbol token + `useClass`
- [x] `reverse-transaction.provider.ts` — Symbol token + `useFactory` (getTx + createTx + accountLookup + eventBus)
- [x] `transaction.usecase.mapper.ts` — `TransactionDto` carries optional `reversedTransactionId`
- [x] `transaction.controller.ts` — `POST /:id/reversals` (201) named-behavior subresource
- [x] `ledger.module.ts` — registers the new providers

### D. Tests
- [x] `tests/ledger/reverse-transaction.e2e.spec.ts` — 6 cases:
  - happy path: post → reverse → 201; mirrored postings (sign + direction); `reversedTransactionId` set; `reference = "Reversal of <orig>"`; cached balances flat (proving the reversal flowed through `TransactionPosted` → `OnTransactionPostedHandler`)
  - 404 `TRANSACTION_NOT_FOUND` on unknown id
  - 422 `ACCOUNT_NOT_ACTIVE` when a referenced account is frozen; balances unchanged (no half-state written)
  - reverse-of-a-reversal: chain depth 2; r2 re-does the original
  - multiple reversals of the same id allowed (append-only; both 201)
  - the original carries no `reversedTransactionId` (one-way link asserted at the HTTP boundary)
- [x] `transaction.aggregate.spec.ts` extended (A.3)
- [x] `pnpm check` clean; `pnpm test` **95 passing** (was 83)

### E. Docs (DoD)
- [x] `architecture/adrs/0011-reversal-as-new-aggregate.md` — captures the lock-in (one-way link, original never updated, flow through `TransactionPosted` without special-casing); alternatives + consequences; references REQ-007/011, ADR-0008/0010
- [x] `architecture/sdds/sdd-ledger.md` — §2 (reverseOf + field), §3 (new use case row + HTTP route), §4 (invariant 6 expanded: factories aren't mutations), §5 (errors), §6 (new `GetTransactionRepository` + entity column + event flow), §7 (REQ-007 exit ✅)
- [x] `epics/002-ledger-core/README.md` — REQ-007 exit checked; progress log entry
- [x] `src/ledger/AGENTS.md` — layout tree updated for the new use case, port, error, ACL, providers, controller route
- [x] retro below

## Execution log

- 2026-05-29 — Gate approved; all 5 default open-question stances accepted: (1) reverse-of-a-reversal allowed; (2) multiple reversals of the same id allowed (idempotency keys forward-looking); (3) `Reversal of <ref>` prefix when original has a reference, else undefined; (4) *active* guard uniform on the reversal post; (5) ADR-0011 written. Branch `feat/reverse-transaction` cut off `feat/ledger-core` (post-PR #4 merge).
- 2026-05-29 — **A:** added `reversedTransactionId` field + getter + snapshot; `reverseOf(original)` static factory negates each posting's signed `Money` (`p.getAmount().negate()`) and synthesizes a fresh aggregate; validator gains a cheap uuid-shape guard; 6 new aggregate spec cases. Mirroring of the 3-posting `(600d, 400d, 1000c)` shape stays balanced (sum of negatives of a zero-sum set is zero).
- 2026-05-29 — **B:** new `GetTransactionRepository` port (segregated — read-only counterpart to `CreateTransactionRepository`); `TransactionNotFoundError` (code `TRANSACTION_NOT_FOUND` → 404); `ReverseTransactionUseCase` orchestrates load → per-posting *active* guard → `reverseOf` → atomic insert → publish. Reuses `TransactionAccountNotFoundError` (404) + `AccountNotActiveError` (422) — the failure shapes already exist from FEAT-007.
- 2026-05-29 — **C:** added the nullable `reversedTransactionId` column (no index in v1; only consumer is a query we don't ship yet); mapper round-trips both directions. `GetTransactionTypeOrmRepository.findById` reads the row, then loads postings `WHERE transactionId = :id ORDER BY sequence ASC` (the sequence order is the historical order the postings were written; matters for any consumer that cares about ordering). Provider wires the use case; the controller adds the new endpoint; the module registers both. Biome reformatted the provider's `inject` line and the aggregate's chained-array `.map` to its preferred shape.
- 2026-05-29 — **D:** the e2e proves the *full loop*. The "balances flat" assertion after the reversal is the load-bearing one — it's evidence the reversal flowed through `TransactionPosted` → the existing FEAT-003 handler in `accounts` with no special case. The "multiple reversals" case is left loose intentionally (asserting both `201`s and distinct ids rather than a specific cached number) — the point is the append-only stance, not a brittle balance calculation; consolidation (FEAT-006) is the recovery path.
- 2026-05-29 — **E:** ADR-0011 written (3 alternatives explicitly rejected with reasons — mutate-the-original, denormalize `reversedBy`, aggregate method, subtype, paired event); SDD-ledger updated (no new section needed — every existing section had an FEAT-004 hook). Epic progress + `ledger/AGENTS.md` layout brought up to date.

## Retro

- **Shipped:** the foil's first real test of "append-only history as a design" — no code path writes to an existing transaction or posting row, and the data layout shows the audit trail directly (two transactions, four postings, a one-way link). REQ-011 is now load-bearing for the design, not a comment in the SRS.
- **Surprises (good):** the cache update story collapsed to zero new code. The reversal's `TransactionPosted` carries negated entries; FEAT-003's `OnTransactionPostedHandler` folds them through `reflectPosting` exactly like a normal post; `lastPostedSeq` advances monotonically because mirror postings receive fresh DB-assigned sequences (always > the original's, since `sequence` is globally append-only). The e2e proves this end-to-end. That's the win — the architecture made the right thing the path of least resistance.
- **Decisions held (durable):** (1) **static factory** over aggregate method — `reverseOf(original)` mirrors `create` / `buildExisting`, doesn't look like a mutation, and reads as "produce a new aggregate from another". (2) **One-way link** on the reversal only — denormalizing `reversedBy` on the original would be a write to an immutable row, even if the value is metadata-only. The query is cheap. (3) **No paired `TransactionReversed` event** — invites consumer special-casing for no win; reversed-ness is visible in the entity via `reversedTransactionId`.
- **Punted (intentional):** transition-style metadata (`reversedAt`, `reason`); a paired `TransactionReversed` event; `GET /transactions/:id/reversals` listing; idempotency keys on the reversal POST (forward-looking; without them, double-POST creates two reversals — documented in the e2e). All captured in ADR-0011 §"Out".
- **What this teaches the comparison:** the DOD side has to make the same call. It can't use a "mutate the original to flag it as reversed" shortcut either (NFR-CORRECT-001 byte-identical JSON forbids it). The shape of the link + the no-paired-event stance should travel intact.
