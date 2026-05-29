---
id: FEAT-005
slug: list-postings
container: 002-ledger-core
mode: B
status: in-implementation
depends-on: [FEAT-002]
blocks: []
---

# FEAT-005 — list postings for an account

## Goal

Close REQ-008: `GET /accounts/:id/postings?from=&to=&limit=&cursor=` returns
an account's postings ordered by `(postedAt, sequence)`, paginated via an
opaque cursor. The first read endpoint on the `ledger` side. Reuses the
existing `AccountLookup` ACL to 404 on a missing account; uses a new
segregated query port to keep the read path explicit and the write
repository unchanged (CQRS-flavored).

## Acceptance criteria

- [x] `GET /accounts/:id/postings` returns 200 with `{ items: PostingListItem[], nextCursor?: string }` (REQ-008).
- [x] Items are ordered `postedAt ASC, sequence ASC` (sequence as deterministic tiebreak).
- [x] Optional `from`/`to` ISO-8601 query params filter the window (inclusive); `from > to` → 422.
- [x] `limit` is a positive integer 1..200; default 50; invalid → 422.
- [x] `cursor` is opaque base64; paging through with `nextCursor` yields a stable, non-overlapping sequence.
- [x] Account does not exist (or soft-deleted) → 404 `ACCOUNT_NOT_FOUND` (reuses `TransactionAccountNotFoundError`'s code; conventional with the rest of the ledger).
- [x] No mutations: postings are immutable (REQ-011) — this is a pure read path; no events emitted.
- [x] e2e: `tests/ledger/list-postings.e2e.spec.ts` — empty list, ordering, window filter, multi-page cursor, 404, 422.

## Scope

**In:** `ListPostingsRepository` query port (segregated; read-only) + TypeORM
impl with cursor-based pagination over `(postedAt, sequence)`;
`ListPostingsUseCase` (framework-free, ADR-0005) — guard via `AccountLookup`
then delegate; `PostingListItem` projection shape (extends `PostingDto` with
`postedAt`, `sequence`, `transactionId`); new `AccountPostingsController` in
`ledger/infrastructure/http/` mounted at `GET /accounts/:id/postings`; cursor
codec (base64 of `${postedAt.toISOString()}|${sequence}`); module wiring.

**Out:** sorting beyond `(postedAt, sequence)`; total-count headers; SQL-level
partitioning / archive read; cross-account list (per the SRS, scoped to one
account).

## Design notes (gate decisions — defaults applied)

- **Cursor over offset.** Postings are append-only; `(postedAt, sequence)`
  is monotonic — cursor pagination is O(1) per page regardless of offset.
  Opaque base64 token avoids leaking schema.
- **Tiebreak on `sequence`** (globally monotonic, DB-assigned). Two postings
  with identical `postedAt` (same `Date.now()`) get a deterministic order.
- **Account 404 via `AccountLookup` ACL.** Reuses FEAT-002's port — no new
  cross-context coupling. The ledger already reads accounts read-only there.
- **No new "AccountNotFound" error class.** Reuses `TransactionAccountNotFoundError`
  (code `ACCOUNT_NOT_FOUND`) — the message is fine for any ledger op that
  references an account. A semantic rename (`LedgerAccountNotFoundError`) is
  a follow-up if more read paths land.
- **HTTP route lives in `ledger`**, not in the accounts controller. The URL
  prefix is `/accounts/:id/` but the data + the query path belong to the
  ledger context. A standalone `AccountPostingsController` keeps the
  bounded-context boundary clean.
- **Controller validation is minimal** — parse query, default `limit=50`,
  decode cursor. Domain/window validation lives in the use case so the rule
  is enforceable from any boundary (not just HTTP).
