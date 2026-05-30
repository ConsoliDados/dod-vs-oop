# Error contracts — `dod-vs-oop-classic`

Per-REQ catalogue of every known failure mode + code + status. Companion
to `srs.md` (which describes the happy path). Closes the SRS's happy-path
bias by writing the sad paths down explicitly, so the tests can be audited
against this list instead of being inferred from code.

The error **shape** is `{ code, message, fields? }` (NFR-OBS-001 in the SRS;
shared between implementations). The **status mapping** is centralised in
`src/shared/infrastructure/http/domain-exception.filter.ts` (per ADR-0002):

- `DomainError` (invalid VO / entity / identifier) → **422**, `code: VALIDATION_ERROR`, message + per-field `fields[]`
- `UseCaseError` with `code` ending in `_NOT_FOUND` → **404**; any other `UseCaseError` → **422**, code preserved
- `HttpException` (framework) → its own status
- anything else → **500**, `code: INTERNAL_ERROR`

Each row below is **a test target**. The "covered by" column points at the spec that exercises it; an empty cell means no negative case exists yet.

## REQ-001 — open an account

| Failure | Code | Status | Covered by |
|---|---|---|---|
| empty `ownerId` | `VALIDATION_ERROR` | 422 | `account.aggregate.spec.ts` |
| whitespace-only `ownerId` | `VALIDATION_ERROR` | 422 | `account.aggregate.spec.ts` |
| unsupported currency | `VALIDATION_ERROR` | 422 | `account.aggregate.spec.ts` |

## REQ-002 — read an account

| Failure | Code | Status | Covered by |
|---|---|---|---|
| id absent / soft-deleted | `ACCOUNT_NOT_FOUND` | 404 | `open-account.e2e.spec.ts` (REQ-002.404 in smoke) |

## REQ-003 — read available balance

| Failure | Code | Status | Covered by |
|---|---|---|---|
| account absent | `ACCOUNT_NOT_FOUND` | 404 | `open-account.e2e.spec.ts` |

## REQ-006 — post a balanced transaction

| Failure | Code | Status | Covered by |
|---|---|---|---|
| < 2 postings | `VALIDATION_ERROR` | 422 | `post-transaction.e2e.spec.ts`, `transaction.aggregate.spec.ts` |
| Σ ≠ 0 (unbalanced) | `VALIDATION_ERROR` | 422 | `post-transaction.e2e.spec.ts`, aggregate spec |
| multi-currency postings | `VALIDATION_ERROR` | 422 | `post-transaction.e2e.spec.ts`, aggregate spec |
| referenced account doesn't exist | `ACCOUNT_NOT_FOUND` | 404 | `post-transaction.e2e.spec.ts` |
| referenced account is `frozen` (FEAT-007) | `ACCOUNT_NOT_ACTIVE` | 422 | `account-lifecycle.e2e.spec.ts` |
| referenced account is `closed` (FEAT-007) | `ACCOUNT_NOT_ACTIVE` | 422 | `account-lifecycle.e2e.spec.ts` |

## REQ-007 — reverse a posted transaction

| Failure | Code | Status | Covered by |
|---|---|---|---|
| original id doesn't exist | `TRANSACTION_NOT_FOUND` | 404 | `reverse-transaction.e2e.spec.ts` |
| a referenced account vanished | `ACCOUNT_NOT_FOUND` | 404 | (covered structurally by post path; reversal reuses the guard) |
| a referenced account is non-`active` | `ACCOUNT_NOT_ACTIVE` | 422 | `reverse-transaction.e2e.spec.ts` |

## REQ-008 — list postings

| Failure | Code | Status | Covered by |
|---|---|---|---|
| account absent | `ACCOUNT_NOT_FOUND` | 404 | `list-postings.e2e.spec.ts` |
| `limit < 1` or `limit > 200` | `VALIDATION_ERROR` | 422 | `list-postings.e2e.spec.ts` |
| invalid ISO-8601 `from`/`to` | `VALIDATION_ERROR` | 422 | `list-postings-boundary.spec.ts` ← new |
| `from > to` | `VALIDATION_ERROR` | 422 | `list-postings.e2e.spec.ts` |
| `from > to` with sub-millisecond diff | `VALIDATION_ERROR` | 422 | (subsumed by above) |
| malformed cursor (not base64 / wrong shape) | `INVALID_CURSOR` | 422 | `list-postings.e2e.spec.ts` + `cursor.spec.ts` ← new |
| cursor with NaN date / negative sequence | `INVALID_CURSOR` | 422 | `cursor.spec.ts` ← new |

**Boundary, not failure** (but tested for monotonicity guarantees):
- `from === to` exactly at a posting's `postedAt` → inclusive (returns that posting). `list-postings-boundary.spec.ts` ← new.
- cursor pointing past the end → empty `items`, no `nextCursor`. `list-postings-boundary.spec.ts` ← new.

## REQ-011 — posting immutability

No client-facing failure — this is a structural invariant. The absence of any `update*Posting` or `delete*Posting` repository operation is the test (it doesn't exist). The reversal path (REQ-007) is the only way to "change" the books.

## REQ-012 — freeze / activate

| Failure | Code | Status | Covered by |
|---|---|---|---|
| account absent | `ACCOUNT_NOT_FOUND` | 404 | `account-lifecycle.e2e.spec.ts` |
| illegal transition (e.g. freeze a `closed`) | `VALIDATION_ERROR` | 422 | `account-lifecycle.e2e.spec.ts` |
| illegal transition (activate an `active`) | `VALIDATION_ERROR` | 422 | `account-lifecycle.e2e.spec.ts` |
| concurrent update — optimistic lock conflict | `VALIDATION_ERROR` *(via `OptimisticLockError extends DomainError`)* | 422 | `account-lifecycle-concurrency.e2e.spec.ts` ← new |

## REQ-013 — close

| Failure | Code | Status | Covered by |
|---|---|---|---|
| account absent | `ACCOUNT_NOT_FOUND` | 404 | `account-lifecycle.e2e.spec.ts` |
| non-zero ledger balance | `ACCOUNT_NOT_CLOSABLE` | 422 | `account-lifecycle.e2e.spec.ts` + `close-account.service.spec.ts` |
| already `closed` (terminal guard) | `VALIDATION_ERROR` | 422 | `account.aggregate.spec.ts` |
| concurrent update — optimistic lock conflict | `VALIDATION_ERROR` *(via `OptimisticLockError`)* | 422 | `account-lifecycle-concurrency.e2e.spec.ts` ← new |

## REQ-014 — consolidate

| Failure | Code | Status | Covered by |
|---|---|---|---|
| account absent | `ACCOUNT_NOT_FOUND` | 404 | `consolidate-balance.e2e.spec.ts` |

No-op (returns the prior snapshot on a stale `throughSeq`) is a success, not a failure. Tested by `consolidate-balance.e2e.spec.ts` "no-op when consolidated again with no new postings".

## Implicit invariants — not from a REQ, from the domain / VOs

These are **rejected at construction time**. A use case never sees them; they fire from inside aggregate / VO smart constructors when an upstream caller (mapper, repository round-trip, application code) hands them invalid data. Covered by the domain unit specs.

| Invariant | Throws | Covered by |
|---|---|---|
| `Money.fromCents` with NaN / Infinity / non-integer / non-safe-integer | `InvalidValueObjectError` | `money.spec.ts` ← extended |
| `Money.add` / `subtract` / `compareTo` / `isGreaterThan` / `isLessThan` across different currencies | `Error: Cannot operate on different currencies: …` | `money.spec.ts` ← extended |
| `Money.divide(0)` | `Error: Cannot divide money by zero` | `money.spec.ts` ← extended |
| `Money.fromCents` with unsupported currency | `InvalidValueObjectError` | `money.spec.ts` ← extended |
| `AccountAggregate.buildExisting` with negative `holdAmount` cents | `InvalidEntityError` (`holdAmount` field) | `account.validator.spec.ts` ← extended |
| `AccountAggregate.buildExisting` with negative `version` | `InvalidEntityError` (`version` field) | `account.validator.spec.ts` ← extended |
| `AccountAggregate.buildExisting` with negative `lastPostedSeq` | `InvalidEntityError` (`lastPostedSeq` field) | `account.validator.spec.ts` ← extended |
| `AccountAggregate.buildExisting` with unknown `status` | `InvalidEntityError` (`status` field) | `account.validator.spec.ts` ← extended |
| `AccountAggregate.buildExisting` with mismatched currency between `availableBalance`/`holdAmount` and the account currency | `InvalidEntityError` | `account.validator.spec.ts` ← extended |
| `TransactionAggregate.buildExisting` with `reversedTransactionId` of wrong length | `InvalidEntityError` (`reversedTransactionId` field) | `transaction.validator.spec.ts` ← extended |
| `decodeCursor` on malformed base64 / missing separator / NaN date / negative sequence / non-integer sequence | `InvalidCursorError` (`UseCaseError`, code `INVALID_CURSOR`) | `cursor.spec.ts` ← new |

## Refinement — swallow-and-log on the cross-context cache path (ADR-0003 refined)

The `OnTransactionPostedHandler` (FEAT-003) is **best-effort by design**. Per-account failures are caught, logged via the `Logger` port with the `accountId` + `cause`, and the handler continues to the next account. The producer (`POST /transactions`) **never** sees a 5xx from a cache hiccup. Failure modes the handler swallows:

| Inner failure | Swallow + log? | Covered by |
|---|---|---|
| `accountId` resolves to `null` from `GetAccountRepository` | yes, logs `account not found; cache desynced (recoverable by recompute)` | `on-transaction-posted.handler.spec.ts` ← new |
| `UpdateAccountRepository.update` throws `OptimisticLockError` | yes, logs `failed to fold posting; cause: Optimistic lock conflict …` | `reflect-balance-desync.e2e.spec.ts` + handler unit spec ← new |
| `account.reflectPosting` throws on currency mismatch (data corruption) | yes, logged same as above | `on-transaction-posted.handler.spec.ts` ← new |
| event with empty `entries[]` | no-op (no account loop runs) | handler unit spec ← new |
| event with multiple accounts where one fails | failing one is logged + skipped; others succeed | handler unit spec ← new |

The desync is observable + recoverable by recompute (FEAT-006 `ConsolidateAccountBalance`); covered end-to-end by `tests/accounts/consolidate-balance.e2e.spec.ts` "snapshot.balance matches the ledger sum even when the cache stayed at 0".

## Status code mapping — known design notes

- `OptimisticLockError` extends `DomainError` → **422** with code `VALIDATION_ERROR`. The HTTP code is technically a conflict (would be 409 in a strict REST mapping), but the foil's filter normalises `DomainError` to 422 for shape consistency. The error message (`Optimistic lock conflict updating account …`) carries the actual nature. A future ADR could introduce a `ConcurrencyError` class mapped to 409 — out of scope for EPIC-002.
- `AccountNotActiveError` is `UseCaseError`, not `DomainError` → code stays `ACCOUNT_NOT_ACTIVE` (preserved through the filter) rather than the generic `VALIDATION_ERROR`. Same precedent as `AccountNotFoundError`.

## When this doc changes

A new failure mode is introduced (new use case, new validator branch, new external boundary) → add a row here **before** writing the test. A row without a test is a TODO; a test without a row is over-specification. Either way the audit is the row.
