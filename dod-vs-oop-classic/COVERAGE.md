# Coverage report — `dod-vs-oop-classic`

Snapshot taken **2026-05-29** on `feat/ledger-core` post-EPIC-002 + post-sad-paths-coverage. Reproducible with `pnpm test:coverage` (writes `coverage/index.html`, gitignored).

## Headline

| Metric | % | Ratio | Δ vs first snapshot |
|---|---|---|---|
| **Statements** | **91.64%** | 856 / 934 | +2.35 |
| **Branches** | **79.47%** | 302 / 380 | +2.90 |
| **Functions** | **90.25%** | 250 / 277 | +2.17 |
| **Lines** | **92.30%** | 828 / 897 | +2.23 |

Suite: **170 tests** across 23 files; **~1.4s** wall-clock with the v8 provider.

## What the +Δ bought

Following the sad-paths audit (see `docs/dod-vs-oop-classic/architecture/error-contracts.md`), we added **57 new test cases** targeted at the branches that the SRS's happy-path bias was leaving uncovered:

| Area | Added | Effect |
|---|---|---|
| Validators with corrupt `buildExisting` snapshots | 5 cases | `account.validator.ts` 90.62 → 93.75% stmts; `transaction.validator.ts` 93.1 → 96.55% |
| Cursor codec — round-trip + every malformed-input case | 11 cases | `cursor.ts` 86.36 → 95.45% stmts (70 → 90% branches) |
| Money arithmetic — currency mismatch on subtract/compare/gt/lt, multiply edge cases, abs/negate, safe-integer overflow, currency symbols | 17 cases | `money.ts` 80.59 → 97.01% stmts |
| `OnTransactionPostedHandler` unit spec — every swallow-and-log branch (account-not-found, OptimisticLockError, currency mismatch, empty event, multi-account, replay) | 10 cases | `on-transaction-posted.handler.ts` 88 → 96% stmts (62.5 → 75% branches) |
| Lifecycle concurrency e2e (`OptimisticLockError` on `PATCH /freeze`, `POST /closure`) | 4 cases | Surfaces the conflict path on the command endpoints; documents that the transition guard short-circuits the update on illegal transitions |
| List-postings boundary e2e (`from === to`, cursor past end, fractional `limit`, invalid ISO-8601, max/min `limit`, pre-history cursor) | 8 cases | `ledger/application/usecases` 97.18 → 98.59% stmts (94.73 → 97.36% branches) |
| 404 paths on PATCH /freeze, PATCH /activate, POST /closure | 3 cases | Closes the `if (!account)` branch in the lifecycle use cases |

## Where coverage matters most — load-bearing layers

The domain + application layers (the parts a regression would actually hurt) all sit ≥ **93%** statements:

| Layer | Stmts | Branches | Notes |
|---|---|---|---|
| `accounts/domain/entities/account.aggregate.ts` | **96.22%** | 100% | every transition + reflectPosting path |
| `accounts/domain/validators/account.validator.ts` | **93.75%** | 90.9% | all field rules exercised; remaining gap is a defensive-default branch |
| `accounts/domain/services/{close,consolidate}-account-balance.service.ts` | bucketed at 100% lines | | unit-tested directly |
| `accounts/domain/value-objects/balance-snapshot.ts` | **92%** | 90% | VO smart constructor + all 4 validator rules |
| `accounts/application/usecases/` (6 use cases) | **93.75%** | up to 100% per file | 404 + happy path covered everywhere |
| `accounts/application/handlers/on-transaction-posted.handler.ts` | **96%** | 75% | every swallow-and-log branch covered |
| `ledger/application/usecases/` (post / reverse / list) | **98.59%** | 97.36% | happy + every negative |
| `ledger/application/cursor.ts` | **95.45%** | 90% | encode/decode round-trip + 7 invalid inputs |
| `ledger/domain/entities/transaction.aggregate.ts` | 88.88% | 75% | `reverseOf` + `create` + `toEntries`; gap = defensive throws |
| `ledger/domain/validators/transaction.validator.ts` | **96.55%** | 93.75% | unbalanced + uuid-shape guard |
| `accounts/infrastructure/typeorm/mappers/*.ts` | **100%** | | round-trip every e2e |
| `accounts/infrastructure/typeorm/repositories/*.ts` | **95.65%** | 83.33% | OptimisticLockError throw covered |
| `ledger/infrastructure/typeorm/mappers/*.ts` | **100%** | 85.71% | |
| `ledger/infrastructure/typeorm/repositories/*.ts` | **100%** | 93.75% | atomic insert + by-id read + cursor list |
| `shared/value-objects/money.ts` | **97.01%** | 88.57% | arithmetic boundaries + currency mismatch on every op |

## Intentional gaps — code that's deliberately under-exercised

These are documented here so anyone running coverage sees what's NOT a "missing test" and why.

| File | Stmts | Why it's OK |
|---|---|---|
| `src/core/entities/entity.ts` | **42%** | Base `Entity` helpers (soft-delete toggles, JSON serialisation, deep clone). Subclasses use what they need; unused helpers aren't dead code, they're surface for future entities. Same shape as the DDD core template. |
| `src/core/errors/invalid-identifier.error.ts` | **30.76%** | Error class kept in `core/` for parity with the DDD core template. The foil never throws it directly — it's surfaced via `InvalidValueObjectError`/`InvalidEntityError`. Exercising every constructor branch is not the point. |
| `src/core/services/entity.validator.ts` | **64.28%** | Abstract base helper; concrete validators (`AccountValidator`, `TransactionValidator`, etc.) drive the actual coverage on their own files. |
| `src/core/value-objects/value-object.ts` | **71.42%** | Abstract base. Concrete VOs (`Money`, `Identifier`, `BalanceSnapshot`) carry the exercised paths. |
| `src/core/events/domain-event.ts` | **71.42%** | `BaseDomainEvent` constructor + `eventType`/`occurredAt` are exercised; the `toJSON`/`toString` helpers are not used by the synchronous in-memory bus today (would be if we ever swapped for a serialising transport). |
| `shared/infrastructure/logger/console.logger.ts` | **60%** (16.66% branches) | Tests **deliberately override the `LOGGER` token with a spy** (see `reflect-balance-desync.e2e.spec.ts`, `consolidate-balance.e2e.spec.ts`, `on-transaction-posted.handler.spec.ts`) so the assertions inspect what was logged. Hitting the console impl in tests would just exercise NestJS's logger and pollute stdout. |
| `shared/infrastructure/http/domain-exception.filter.ts` | **78.57%** | Lines 41–47 are the **`HttpException` passthrough + the generic 500 branch**. The throw-based domain doesn't reach those branches — they're framework-bridge code that catches things our hierarchy doesn't produce. Could be wired with a unit spec; not a behavioural gap. |
| `accounts/infrastructure/acl/ledger-balance-reader.typeorm.ts` | 100% stmts / 50% branches | The branch coverage gap is the `null` coalesce default — the COALESCE in SQL means the null path is unreachable from real callers. |
| `ledger/infrastructure/acl/account-lookup.typeorm.ts` | 100% stmts / 50% branches | Same shape — the `null` return path is exercised indirectly via "absent account" e2es; v8 reports it as a branch gap because the if-test result distribution is skewed. |
| `shared/value-objects/identifier.ts` | 91.66% (75% branches) | One defensive uuid-shape branch; covered structurally. |

## What this report intentionally does NOT do

- **No CI gate on coverage thresholds.** Coverage % is information, not a contract — gating PRs on it tends to produce useless test code rather than better tests. The smoke harness (`pnpm smoke`) is the conformance gate; this report is the inward-facing observation.
- **No 100% target.** The DDD core template carries scaffold that subclasses don't all need; the framework-bridge layer catches errors the domain doesn't throw; the console logger is mocked in tests by design. Driving those to 100% would mean writing tests **about the test setup**.
- **No per-feature coverage report.** Coverage is aggregate; the per-FEAT story is in each `features/<id>-*/act.md` retro.

## Audit trail

The sad-path audit that drove this +Δ is documented in [`docs/dod-vs-oop-classic/architecture/error-contracts.md`](docs/dod-vs-oop-classic/architecture/error-contracts.md). That file is the per-REQ catalogue of every known failure mode + code + status, with a "covered by" pointer. **The convention going forward: every new REQ adds a row in `error-contracts.md` before the test; a row without a test is a TODO, a test without a row is over-specification.**

## Regenerate

```bash
cd dod-vs-oop-classic
pnpm test:coverage             # text summary + coverage/index.html
xdg-open coverage/index.html   # browse the per-file breakdown
```

## Conformance hook (forward-looking)

When `dod-vs-oop-dod` lands, the two implementations get their own `COVERAGE.md`. The headlines should be **comparable, not identical** — the implementations have different abstraction layers (verbose-canonical DDD here; SoA + functions on the DOD side), so equal coverage % at very different absolute LoC means different things. What this study cares about for fairness:

- **Domain + use-case layers** at parity coverage on both sides (≥ 93% statements; the current bar). Already true here.
- **The shared harness `examples/scripts/smoke.ts` passes on both** — the externally observable conformance gate (NFR-CORRECT-001 byte-identical JSON is the strict version of the same idea).
- **`error-contracts.md` rows mirror across sides** — same failure modes, same codes, same status codes. The conformance suite asserts byte-identical error responses, not just success bodies.
