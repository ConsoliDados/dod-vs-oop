# FEAT-005 list-postings — Research

RPA stage 1 (condensed for epic close-out speed).

## Sources / prior art

- **REQ-008** — `GET /accounts/:id/postings?from=&to=&limit=` paginated, ordered by `postedAt`.
- **FEAT-002** — `Posting` rows already carry `accountId`, `postedAt`, `sequence` (the latter as DB-generated monotonic PK). Two indices already cover the read: `accountId` (declared on `PostingTypeOrmEntity`) — the query plan filters on it cheap.
- **FEAT-002 `AccountLookup` ACL** — reused to 404 on a missing account; no new cross-context coupling.

## Current state (verified)

- No read repositories on the ledger; only `CreateTransactionRepository` (write) and `GetTransactionRepository` (FEAT-004 — by-id). No list paths today.
- `PostingTypeOrmEntity` has `@Index()` on `accountId` and `@Index()` on `transactionId`. `sequence` is the primary key (auto-incremented). `postedAt` has no index — fine for the foil's data volumes; production would add `(accountId, postedAt, sequence)`.
- The accounts side doesn't import ledger (and won't) — the read path lives in `ledger`. The URL prefix is `/accounts/:id/postings`; we add an `AccountPostingsController` in `ledger/infrastructure/http/` using `@Get('accounts/:id/postings')` (no `@Controller('accounts')` — direct path declaration keeps grep-discoverability).

## Decisions

1. **Cursor-based pagination** with tuple `(postedAt, sequence)`. Opaque base64-encoded token: `base64(postedAt.toISOString() + '|' + sequence)`. SQL: `WHERE postedAt > :pAt OR (postedAt = :pAt AND sequence > :seq)`.
2. **Limit 1..200; default 50.** Caps response size. Validated in the use case (any boundary inherits the rule).
3. **`PostingListItem`** = `PostingDto` + `postedAt: string` + `sequence: number` + `transactionId: string`. The transaction id lets clients join to the transaction; cheap.
4. **404 on missing account** via `AccountLookup.findById`. Soft-deleted accounts read as null (existing behavior). Use `TransactionAccountNotFoundError` (code `ACCOUNT_NOT_FOUND`) — no new class for this slice.
5. **No event emission, no domain mutation.** Pure read; the use case is a `QueryUseCase`.

## Tradeoffs

- **Cursor vs offset** — cursor wins on append-only data (no `OFFSET n` scan; safe under concurrent inserts).
- **Reuse `TransactionAccountNotFoundError`** — its code `ACCOUNT_NOT_FOUND` is the HTTP-visible contract; the class name is internal. A semantic rename is a separate follow-up.
- **Controller location** — direct `@Get('accounts/:id/postings')` in a new `AccountPostingsController` in `ledger/`, not adding to accounts' `AccountController`. Keeps the ledger as sole reader of postings; the URL prefix doesn't dictate ownership.
