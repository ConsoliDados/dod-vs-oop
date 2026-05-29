---
id: EPIC-002
slug: ledger-core
type: capability
status: planned
owner: Johnny Carreiro
target_window:
roadmap_cards: []
sprints: []
related_decisions: [ADR-0001, ADR-0002, ADR-0003, ADR-0004, ADR-0005, ADR-0006]
exits_with:
  - account open + read + balance (REQ-001, REQ-002, REQ-003)
  - balanced double-entry posts; unbalanced/currency-mismatch rejected 422 (REQ-006)
  - reversal mirrors a transaction; postings immutable (REQ-007, REQ-011)
  - balance reflects posted transactions via TransactionPosted event (REQ-003 cross-context)
  - postings listable, paginated, over a window (REQ-008)
  - sdd-ledger.md + sdd-accounts.md written (promotion trigger)
  - unit (co-located) + integration (tests/) covering happy + negative paths
  - all endpoints return SRS shapes + status codes
---

# EPIC-002 — ledger core

<!-- type: capability — the first product-value vertical slice. -->

## Why

The whole study hinges on a domain that exercises the foil's full stack: rich aggregates, per-entity validators (throw-based), segregated repositories, bidirectional mappers, and cross-context events on the synchronous in-memory bus. The smallest slice that delivers observable value **and** touches all of that is the **core money movement**: open accounts, post a balanced double-entry transaction across them, and read balances that reflect it. Everything later (holds lifecycle, statements, reconciliation) builds on this.

## Outcome

A client can:
1. Open a single-currency account and read it and its (zero, initially) available balance.
2. Post a balanced double-entry transaction across existing accounts; unbalanced or currency-mismatched transactions are rejected.
3. See affected accounts' available balances update — via the `TransactionPosted` domain event on the in-memory EventBus (cross-context, no Outbox).
4. Reverse a transaction (mirror postings; the original is never mutated).
5. List an account's postings, paginated, over a time window.

End-to-end this proves the verbose-canonical architecture works as a foil, with the full chain Controller → UseCase → Aggregate+Validator (throw) → segregated Repository → TypeORM Mapper, plus the cross-context event handler.

## Scope (in)

- **accounts context (minimal)**: `AccountAggregate` (id, ownerId, currency, status, availableBalance, holdAmount, version), open/read/balance use cases, segregated repos, TypeORM entity + mapper, controller.
- **ledger context**: `TransactionAggregate` + `Posting` entity, double-entry invariant validation, post + reverse + list-postings use cases, segregated repos, TypeORM entities + mappers, controller; emits `TransactionPosted` / `TransactionReversed`.
- **cross-context**: `accounts` subscribes to `TransactionPosted` and updates cached `availableBalance` via the in-memory EventBus (ADR-0003).
- **tests**: co-located unit (aggregates, validators) + integration in `tests/` (NestJS in-process, full flow).
- **docs**: `sdds/sdd-ledger.md` + `sdds/sdd-accounts.md` (promotion trigger fires — 5+ use cases across these contexts).

## Out of scope

- **Holds lifecycle** (REQ-004, REQ-005) — `place/release hold` deferred to a later accounts-deepening epic. `holdAmount` exists on the aggregate (starts 0) but no hold endpoints yet.
- **Statements** (REQ-009, CPU-bound #1) — EPIC-003.
- **Reconciliation** (REQ-010, CPU-bound #2) — EPIC-004.
- **Cross-implementation conformance** (NFR-CORRECT-001) — gated at study level once the DOD side exists; within this epic we assert SRS shapes/status codes per-impl only.

## Exits with

- [x] Account can be opened, read, and its available balance read (REQ-001, REQ-002, REQ-003) — FEAT-001
- [x] Balanced double-entry transaction posts (201); unbalanced (`Σdebits ≠ Σcredits`) or currency-mismatched rejected (422) (REQ-006) — FEAT-002
- [x] Reversal creates a mirror transaction; no posting is ever mutated (REQ-007, REQ-011) — FEAT-004
- [x] Affected account balances reflect posted transactions via `TransactionPosted` on the in-memory EventBus (REQ-003 cross-context, ADR-0003) — FEAT-003
- [x] Postings listable, paginated, over a `[from,to]` window (REQ-008) — FEAT-005
- [x] Account can be frozen/reactivated and closed (closed only at a ledger-verified zero balance); a non-active account is rejected when posting (REQ-012/013, REQ-006 *active*; ADR-0010) — FEAT-007
- [ ] `sdds/sdd-ledger.md` + `sdds/sdd-accounts.md` written (promotion trigger: 5+ use cases)
- [ ] Unit tests co-located + integration tests in `tests/` cover happy + at least one negative path per endpoint
- [ ] All endpoints return SRS-specified response shapes and status codes

## Related decisions

- ADR-0001 — Stack (NestJS + TypeORM + sqlite memory)
- ADR-0002 — Throw on first violation
- ADR-0003 — Synchronous in-memory EventBus (no Outbox)
- *(anticipated)* SDD-ledger, SDD-accounts — tactical design, written during the epic
- ADR-0004 — Money as integer minor units (no Decimal library); high-precision policy for interest/FX/installments
- ADR-0005 — Framework-agnostic application layer (use cases free of NestJS; DI wiring in `infrastructure/provider/`)
- ADR-0006 — Balance as immutable snapshots + consolidation domain service (cache overwrites, snapshot appends)

## Risks / open questions

- **Validator throws inside constructor + TypeORM hydration**: `buildExisting(props)` must reconstruct from trusted DB rows without spuriously throwing. Decide reconstruction-vs-revalidation policy in FEAT-001 research.
- **sqlite `:memory:` lifecycle per test**: fresh DB per test (isolation) vs shared (speed). Decide in FEAT-001 plan; likely `synchronize: true` + fresh datasource per integration test.
- **Money as integer cents in TypeORM**: column type (`bigint` vs `integer`) and overflow. Decide in FEAT-001/002; cross-link to `Money` VO.
- **Cross-context balance update timing**: with sync EventBus, the handler runs in-process after persistence — if it throws, the cached balance desyncs (ADR-0003 trade-off). Per ADR-0006 the **cache is recomputable and never authoritative alone** (NFR-DATA-001) and the immutable `BalanceSnapshot` trail is untouched by the per-posting path, so a desync is recoverable by recompute; test the desync explicitly.
- **Consolidation idempotency** (FEAT-006, ADR-0006): `ConsolidateAccountBalance` must not double-count — guarded by the snapshot's `throughSeq`. The exact checkpoint key (per-account posting sequence vs `postedAt`+id) is finalized with FEAT-002's `Posting` shape.

## Planning (Mode B)

`sprints/` stays empty; this section is the capacity/picks snapshot for the features under `features/`.

**Capacity**: 1 contributor (human + AI agent), kanban-flow, no time-box.

**Feature breakdown & order:**

| FEAT | Slug | Context | Delivers | Depends on | Exits it advances |
|------|------|---------|----------|------------|-------------------|
| 001 | open-account | accounts | `AccountAggregate`, `POST /accounts`, `GET /accounts/:id`, `GET /accounts/:id/balance` (balance 0 until postings) | — | REQ-001/002/003 |
| 002 | post-transaction | ledger | `TransactionAggregate` + `Posting`, double-entry validation, `POST /transactions`, emits `TransactionPosted` | 001 | REQ-006, REQ-011 |
| 003 | reflect-balance-on-posting | accounts | `OnTransactionPosted` handler **overwrites** cached `availableBalance` + advances checkpoint marker; lands the immutable `BalanceSnapshot` VO (ADR-0006) | 002 | REQ-003 cross-context |
| 004 | reverse-transaction | ledger | `POST /transactions/:id/reversals` (mirror tx), `TransactionReversed` | 002 | REQ-007 |
| 005 | list-postings | ledger | `GET /accounts/:id/postings?from=&to=&limit=` paginated | 002 | REQ-008 |
| 006 | consolidate-balance | accounts | `ConsolidateAccountBalance` domain service → appends a `BalanceSnapshot` as-of T (thin, idempotent); cold/archive tiering forward-looking (ADR-0006) | 002, 003 | NFR-DATA-001, NFR-PERF (fold-over-postings) |
| 007 | account-lifecycle | accounts | `freeze`/`activate`/`close` behaviors + `CloseAccountService` (close gated by balance recomputed from the ledger via the `LedgerBalanceReader` ACL); `frozen`/`closed` reject postings via `AccountLookup`+`status` (ADR-0010) | 001, 003 | REQ-012/013, REQ-006 (active) |

**Sequence**: 001 → 002 → 003, then **007 (account-lifecycle), pulled ahead** of 004 and 005 (decision 2026-05-27 — exercises rich aggregate behavior + the first domain service); then 004 and 005 (independent, both depend on 002); 006 (consolidate-balance) after 003. SDDs (`sdd-accounts.md`, `sdd-ledger.md`) drafted as 001/002 land and refined through the epic. FEAT-007 extends the shared SRS (REQ-012/013).

**Only FEAT-001 is created as a folder now** (next up). Features 002–005 are created via the `feature-template` Templater snippet when picked, per methodology (don't create cards before they're picked).

**Agent note**: each context gets its own `src/<context>/AGENTS.md` (from `playbook/agents/module-AGENTS.template.md`) once it reaches 5+ public items — expected during FEAT-002 for `ledger` and FEAT-003 for `accounts`.

## Progress log

- 2026-05-21 — Planned. FEAT-001 (open-account) RPA created.
- 2026-05-21 — **FEAT-001 (open-account) implemented** (pending human review at gate §16.3, not yet committed). Delivered the `accounts` context end-to-end: `AccountAggregate` + `AccountValidator` (throw-based), `AccountOpenedEvent`, segregated `Create`/`Get` repos with TypeORM impls + bidirectional mapper, `Open`/`Get`/`GetBalance` use cases, `AccountController`, shared `DomainExceptionFilter` (SRS error shape) and `@Global` `SharedModule` (EventBus). Money refactored to integer minor units (ADR-0004, Task 0). Promotion trigger fired → `sdd-accounts.md` (SDD-001) drafted + `src/accounts/AGENTS.md` created. Gates green: `pnpm check` (biome + typecheck) + `pnpm test` (35 tests). Bootstrap fixes en route: `better-sqlite3` native addon was unbuilt (pnpm 10 build-script gate) → added `pnpm.onlyBuiltDependencies` + rebuilt; added Biome `unsafeParameterDecoratorsEnabled` for NestJS param decorators. REQ-001/002/003 exit checked.
- 2026-05-22 — **Application decoupled from NestJS (ADR-0005).** Use cases became framework-free plain classes taking ports; DI tokens + providers moved to `src/accounts/infrastructure/provider/{usecases,repositories}/`; the NestJS module moved into `infrastructure/`; introduced the `EventBus` port. Motivated by the planned Bun+Elysia re-host (honest multi-axis benchmark) + SAD §4. Playbook + AGENTS + SDD updated. Gates still green (35 tests).
- 2026-05-22 — **FEAT-002 (post-transaction) implemented** (pending review at gate §16.3; branch `feat/post-transaction` stacked on `feat/open-account`). Delivered the `ledger` context end-to-end: `TransactionAggregate` + `Posting` (signed-Money double-entry; ≥2, balanced Σ==0, single-currency, throws), `TransactionPostedEvent`, framework-free `PostTransactionUseCase`, `AccountLookup` port + TypeORM ACL (reads accounts read-only), atomic `CreateTransactionRepository`, `TransactionController` (`POST /transactions`). Finalized ADR-0006 `throughSeq` = global posting `sequence`. `sdd-ledger.md` (SDD-002) + `src/ledger/AGENTS.md` written. Gates green: `pnpm check` + 49 tests. REQ-006/011 exit checked. Next: FEAT-003 (reflect-balance-on-posting).
- 2026-05-22 — **Balance model decided (ADR-0006)** ahead of FEAT-003. Two representations: a recomputable **cache** on `AccountAggregate` (overwritten per posting) + an **immutable `BalanceSnapshot` VO** persisted append-only (audit trail). Current = latest snapshot + Σ(postings after `throughSeq`). Consolidation = idempotent domain service (`ConsolidateAccountBalance`), added as FEAT-006. Refined SRS (NFR-DATA-001 + glossary), SAD (§5.6 + dataflow), this epic. Cold/archive tiering forward-looking. Implementation deferred pending human review of the ADR. Next: FEAT-002 (post-transaction, `ledger`).
- 2026-05-27 — **FEAT-003 (reflect-balance-on-posting) implemented** (pending review at gate §16.3; branch `feat/reflect-balance-on-posting` off `feat/ledger-core`). `accounts` now **subscribes** to `TransactionPosted` and folds each account's net signed delta into the cached `availableBalance` + advances the `lastPostedSeq` checkpoint via a new `AccountAggregate.reflectPosting` (REQ-003 cross-context). Added `UpdateAccountRepository` (optimistic-lock) + framework-free `OnTransactionPostedHandler` (registered in `onModuleInit`) + the immutable `BalanceSnapshot` VO (**type only**; persistence + `ConsolidateAccountBalance` stay FEAT-006). **ADR-0008**: `TransactionPosted` now carries each posting's `sequence`, built by `PostTransactionUseCase` from the persisted postings, so `accounts` needn't read ledger tables. Gates green: `pnpm check` + 60 tests. REQ-003 cross-context exit checked. Next: FEAT-004 (reverse) / FEAT-005 (list-postings).
- 2026-05-27 — **FEAT-007 (account-lifecycle) designed + documented** (not yet implemented; **pulled ahead of FEAT-004/005** per the domain-model discussion — it's where rich aggregate behavior + the first cross-aggregate domain service appear). Extends the shared SRS (REQ-012/013 + REQ-006 *active*); **ADR-0010** (status lifecycle + `CloseAccountService` close-by-ledger-recompute via the `LedgerBalanceReader` ACL); RPA (research + plan) under `features/007-account-lifecycle/`; SDD (`sdd-accounts` + `sdd-ledger`) updated. Design docs committed on `feat/reflect-balance-on-posting` (PR #3) for review alongside FEAT-003 code; implementation begins after approval + after FEAT-003 merges.
- 2026-05-28 — **FEAT-003 code-review follow-up applied on `feat/reflect-balance-on-posting`** (PR #3 updated, not merged). **Swallow-and-log refinement** on the cross-context cache path: typed `OptimisticLockError extends DomainError` from `UpdateAccountTypeOrmRepository`; per-account `try/catch` + `Logger.warn(accountId, cause)` in `OnTransactionPostedHandler` — never rethrows to `POST /transactions`. Narrow, documented exception to ADR-0003's blanket propagate rule, scoped to the recomputable-cache path (NFR-DATA-001; ADR-0006 untouched). New minimal `Logger` port in `shared/application/` + `ConsoleLogger` impl. **Desync test promised by this README now real:** `tests/accounts/reflect-balance-desync.e2e.spec.ts` (POST still 201, balances stale, warning per affected account). Doc corrections: `sdd-ledger.md` marks FEAT-007's `status`-aware lookup + non-`active` rejection as **planned/pending** (was present-tense as-if-shipped); `transaction-posted.event.ts` doc-comment fixed (built post-persistence, not at `create()`); ADR-0006 finalizes `throughSeq` = **global** posting sequence; SAD §4 clarifies the cross-context payload pattern (producer-owned + consumer-redeclared local contract); FEAT-003 feature.md softens the "both checkpoints advanced" e2e claim (checkpoint monotonicity = unit-tested). Hardened the happy-path bystander (prior non-zero balance). `pnpm check` clean; `pnpm test` 61 passing (was 60).
- 2026-05-28 — **FEAT-007 (account-lifecycle) implemented** on `feat/account-lifecycle` (off the post-PR-#3 `feat/ledger-core`; pending review). `AccountAggregate` now carries the three intention-revealing transitions `freeze()`/`activate()`/`close()` with a private `assertTransition(from[], to)` state-machine guard (active⇄frozen; active|frozen→closed; closed terminal — illegal → `InvalidEntityError` → 422). The study's **first cross-aggregate domain service**, `CloseAccountService` (pure, no I/O), lives in `accounts/domain/services/` — it receives the **ledger-recomputed** balance from the use case and either throws `AccountNotClosableError` (→ 422) or delegates the transition to `account.close()` (ADR-0010). New ACL **`LedgerBalanceReader`** port (accounts→ledger) + `LedgerBalanceReaderTypeOrm` impl (`COALESCE(SUM(amountCents), 0)` over `postings`) — reverse of FEAT-002's `AccountLookup`; single accounts→ledger infra touch (ADR-0009 distribution seam); wired via `PostingTypeOrmEntity` in `accounts.module`'s `TypeOrmModule.forFeature`. Three new framework-free use cases (`FreezeAccount` / `ActivateAccount` / `CloseAccount`); three new named-behavior endpoints (`PATCH /accounts/:id/freeze`, `PATCH /accounts/:id/activate`, `POST /accounts/:id/closure`). **Ledger side:** `AccountView` widens to carry `status` (mirrored locally as `AccountLookupStatus` — no `accounts/domain` import); `PostTransactionUseCase` rejects non-`active` references with `AccountNotActiveError` (→ 422, REQ-006 *active*). Tests: `account.aggregate.spec` (10 new transition cases), `close-account.service.spec` (5 cases), `tests/accounts/account-lifecycle.e2e.spec.ts` (8 cases — happy paths, illegal transitions, close-by-recompute uses the ledger not the cache, post-to-frozen/closed rejected). SDDs (`sdd-accounts` + `sdd-ledger`) flipped from planned/pending to live; `act.md` written. `pnpm check` clean; `pnpm test` **83 passing** (was 61). REQ-012/013 + REQ-006 *active* exit checked.
- 2026-05-29 — **FEAT-005 (list-postings) implemented** on `feat/list-postings` (off post-PR-#5 `feat/ledger-core`; pending review). First read path on the ledger: `GET /accounts/:id/postings?from=&to=&limit=&cursor=` (REQ-008). New segregated query port `ListPostingsRepository` + TypeORM impl with **cursor-based pagination over `(postedAt, sequence)`** (the deterministic order shared with ADR-0006's `throughSeq` checkpoint) — opaque base64 cursor (`postedAt.toISOString()|sequence`). Use case (framework-free, ADR-0005, `QueryUseCase`) does the semantic validation (`limit ∈ [1,200]`, `from`/`to` ISO-8601, `from ≤ to`, cursor round-trip) so any caller inherits the rule, and 404s via the existing `AccountLookup` ACL. New `AccountPostingsController` in `ledger/infrastructure/http/` (URL prefix is the account's; data ownership is the ledger's). `PostingListItem` projection extends `PostingDto` with `postedAt`, `sequence`, `transactionId`. New `InvalidCursorError` (code `INVALID_CURSOR` → 422). 8 new e2e cases (empty list; ordering; window filter; 3-page pagination with strictly-monotonic non-overlapping sequences; 404; `limit=0`; `limit>200`; `from > to`; malformed cursor). `pnpm check` clean; `pnpm test` **103 passing** (was 95). REQ-008 exit checked.
- 2026-05-29 — **FEAT-004 (reverse-transaction) implemented** on `feat/reverse-transaction` (off post-PR-#4 `feat/ledger-core`; pending review). RPA gate passed with all 5 default open-question stances accepted (reverse-of-a-reversal allowed; multiple reversals allowed; `Reversal of <ref>` prefix; *active* guard uniform on the reversal post; ADR-0011 written). Domain: new static factory `TransactionAggregate.reverseOf(original)` produces a new aggregate with **mirrored postings** (each posting's signed `Money` negated) linked one-way via `reversedTransactionId`; new optional `reversedTransactionId?: string` field + validator guard; original never touched (REQ-011 hard). Application: new `GetTransactionRepository` segregated port + impl + `TransactionNotFoundError` (→ 404 `TRANSACTION_NOT_FOUND`); new `ReverseTransactionUseCase` (framework-free, ADR-0005) — load → per-posting `AccountLookup` *active* guard (reuses FEAT-007 `AccountNotActiveError`) → `reverseOf` → atomic `CreateTransactionRepository.insert` → publish `TransactionPosted` with the mirror entries (ADR-0008). Infra: new nullable column `reversedTransactionId` on `transactions` + mapper round-trip; `POST /transactions/:id/reversals` named-behavior endpoint (201). **No new handler in `accounts`** — the reversal's `TransactionPosted` flows through the existing FEAT-003 `OnTransactionPostedHandler` and the mirror deltas cancel the original's cached effect (sequences advance monotonically because mirror postings receive fresh DB-assigned sequences). Tests: `transaction.aggregate.spec` (6 new `reverseOf` cases — sign flip per posting, link captured, fresh ids, reference prefix, reverse-of-reversal, 3-posting mirror), `tests/ledger/reverse-transaction.e2e.spec.ts` (6 cases — happy path with balance flat-out, 404, 422 active guard, chain of length 2, multiple reversals of same id, original carries no link). **ADR-0011** captures the lock-in (one-way link, original never updated, flow through `TransactionPosted` without special-casing). sdd-ledger updated (§2/§3/§4/§5/§6/§7 — REQ-007 exit checked). `pnpm check` clean; `pnpm test` **95 passing** (was 83). REQ-007 + REQ-011 exit checked.
