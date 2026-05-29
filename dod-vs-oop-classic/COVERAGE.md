# Coverage report — `dod-vs-oop-classic`

Snapshot taken **2026-05-29** on `feat/ledger-core` post-EPIC-002. Reproducible with `pnpm test:coverage` (writes `coverage/index.html`, gitignored).

## Headline

| Metric | % | Ratio |
|---|---|---|
| **Statements** | **89.29%** | 834 / 934 |
| **Branches** | **76.57%** | 291 / 380 |
| **Functions** | **88.08%** | 244 / 277 |
| **Lines** | **90.07%** | 808 / 897 |

Suite: **113 tests** across 19 files; **~1.4s** wall-clock with the v8 provider.

## Where coverage matters most — load-bearing layers

The domain + application layers (the parts a regression would actually hurt) sit in the **90%+** band:

| Layer | Stmts | Notes |
|---|---|---|
| `accounts/domain/entities/account.aggregate.ts` | **96.22%** | full transition + reflectPosting paths exercised |
| `accounts/domain/validators/account.validator.ts` | **90.62%** | every validate*() method hit; uncovered = unreachable branches |
| `accounts/domain/value-objects/balance-snapshot.ts` | **92.00%** | VO smart constructor + all 4 validator rules |
| `accounts/domain/services/close-account.service.ts` | (in `usecases` bucket; 100% line) | unit-tested directly |
| `accounts/domain/services/consolidate-account-balance.service.ts` | (in `usecases` bucket) | unit-tested directly |
| `accounts/application/usecases/` (6 use cases) | **93.75%** | per-use-case 88–100% |
| `accounts/application/handlers/on-transaction-posted.handler.ts` | **88.00%** | the swallow-and-log branches that don't fire in happy-path e2e are the gap |
| `ledger/application/usecases/` | **97.18%** | post / reverse / list — all happy + negative |
| `ledger/domain/entities/transaction.aggregate.ts` | **88.88%** | `reverseOf` + `create` + `toEntries`; gap = a couple of `getCurrency` defensive throws (unreachable post-validation) |
| `accounts/infrastructure/typeorm/mappers/*.ts` | **100%** | round-trip exercised by every e2e |
| `accounts/infrastructure/typeorm/repositories/*.ts` | **95.65%** | the OptimisticLockError throw path is covered by the desync e2e |
| `ledger/infrastructure/typeorm/mappers/*.ts` | **100%** | |
| `ledger/infrastructure/typeorm/repositories/*.ts` | **100%** | atomic insert + by-id read + list with cursor |

## Intentional gaps — code that's deliberately under-exercised

| File | % | Why it's OK |
|---|---|---|
| `src/core/entities/entity.ts` | **42%** | Base `Entity` helpers (soft-delete toggles, JSON serialisation, deep clone). Subclasses use what they need; unused helpers aren't dead code, they're surface for future entities. Same shape as the DDD core template (`~/Dev/projects/ddd-templates`). |
| `src/core/errors/invalid-identifier.error.ts` | **30.76%** | Error class kept in `core/` for parity with the DDD core template. The foil never throws it directly — it's surfaced via `InvalidValueObjectError`/`InvalidEntityError`. The class exists to be available; exercising every constructor branch is not the point. |
| `src/core/services/entity.validator.ts` | **64.28%** | Abstract base helper; concrete validators (`AccountValidator`, `TransactionValidator`, etc.) drive the actual coverage on their own files. |
| `src/core/value-objects/value-object.ts` | **71.42%** | Abstract base. Same logic as `entity.ts` — concrete VOs (`Money`, `Identifier`, `BalanceSnapshot`) carry the exercised paths. |
| `src/core/events/domain-event.ts` | **71.42%** | `BaseDomainEvent` constructor + `eventType`/`occurredAt` are exercised; the `toJSON`/`toString` helpers are not used by the synchronous in-memory bus today (would be if we ever swapped for a serialising transport). |
| `shared/infrastructure/logger/console.logger.ts` | **40%** | The console-backed `Logger` impl. Tests **deliberately override the `LOGGER` token with a spy** (see `reflect-balance-desync.e2e.spec.ts` / `consolidate-balance.e2e.spec.ts`) so the assertions inspect what was logged. Hitting the console impl in tests would just exercise NestJS's logger and pollute stdout. |
| `shared/infrastructure/http/domain-exception.filter.ts` | **78.57%** | Lines 41–47 are the **`HttpException` passthrough + the generic 500 branch**. The error hierarchy in `src/core/errors/` doesn't reach those branches under the existing tests — they're framework-bridge code that catches things our throw-based domain doesn't produce. Could be wired with a unit spec; not a behavioural gap. |
| `shared/value-objects/money.ts` | **80.59%** | `format` (localisation branches) + a couple of `decimalPlacesOf` fallback paths are unused in the e2e — the formatter is for clients we don't have. |
| `ledger/infrastructure/acl/account-lookup.typeorm.ts` | **100% stmts / 50% branches** | The branch coverage gap is the `null` return path: every existing test that hits a missing account does so via account ids the use case rejects before the ACL ever sees them. The behaviour is covered indirectly. |

## What this report intentionally does NOT do

- **No CI gate on coverage thresholds.** Coverage % is information, not a contract — gating PRs on it tends to produce useless test code rather than better tests. The smoke harness (`pnpm smoke`) is the conformance gate; this report is the inward-facing observation.
- **No 100% target.** The DDD core template carries scaffold that subclasses don't all need; the framework-bridge layer catches errors the domain doesn't throw; the console logger is mocked in tests by design. Driving those to 100% would mean writing tests **about the test setup**.
- **No per-feature coverage report.** Coverage is aggregate; the per-FEAT story is in each `features/<id>-*/act.md` retro.

## Regenerate

```bash
cd dod-vs-oop-classic
pnpm test:coverage             # text summary + coverage/index.html
xdg-open coverage/index.html   # browse the per-file breakdown
```

## Conformance hook (forward-looking)

When `dod-vs-oop-dod` lands, the two implementations get their own `COVERAGE.md`. The headlines should be **comparable, not identical** — the implementations have different abstraction layers (verbose-canonical DDD here; SoA + functions on the DOD side), so equal coverage % at very different absolute LoC means different things. What this study cares about for fairness:

- **Domain + use-case layers** at parity coverage on both sides (≥ 90% statements). Already true here.
- **The shared harness `examples/scripts/smoke.ts` passes on both** — the externally observable conformance gate (NFR-CORRECT-001 byte-identical JSON is the strict version of the same idea).
