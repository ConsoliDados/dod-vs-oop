# FEAT-005 list-postings — Act

RPA stage 3 (condensed).

## Tasks
- [x] A. `application/repositories/list-postings.repository.ts` + `application/mappers/posting-list.mapper.ts` (`PostingListItem`) + `application/cursor.ts` (base64 codec + `InvalidCursorError`) + `application/usecases/list-postings.usecase.ts` (`QueryUseCase`; validates `limit`, window, cursor; 404 via `AccountLookup`).
- [x] B. `infrastructure/typeorm/repositories/list-postings.typeorm.repository.ts` (queryBuilder; tuple cursor compare; `take(limit+1)` for `nextCursor` detection) + providers + `AccountPostingsController` (`@Get('accounts/:id/postings')`) + `ledger.module` wiring.
- [x] C. `tests/ledger/list-postings.e2e.spec.ts` — 8 cases (empty, ordering, window, 3-page pagination, 404, `limit=0`, `limit>200`, `from > to`, malformed cursor).
- [x] D. SDD-ledger updated (§3, §5, §6, §7 → REQ-008 ✅); epic progress + exit check; `src/ledger/AGENTS.md` layout refreshed.
- [x] `pnpm check` clean; `pnpm test` **103 passing** (was 95).

## Execution log

- 2026-05-29 — Branch `feat/list-postings` cut off post-PR-#5 `feat/ledger-core`. Condensed RPA (research+plan) committed before implementation; gate defaults applied (cursor over offset; reuse `TransactionAccountNotFoundError`; controller in `ledger`).
- 2026-05-29 — A: port + use case landed first; the use case validation is in the use case (not the controller) so HTTP/CLI/batch callers share the rule.
- 2026-05-29 — B: tuple cursor compare via `WHERE postedAt > :pAt OR (postedAt = :pAt AND sequence > :seq)` — works in sqlite without lexicographic-tuple support. `take(limit+1)` is the conventional "is-there-more" probe.
- 2026-05-29 — C: the e2e's pagination case asserts **sequences are strictly monotonic across pages and have no overlap** — that's the load-bearing guarantee of cursor pagination; an off-by-one in the tuple compare would fail it loudly.
- 2026-05-29 — D: SDD/epic/AGENTS bumped. `pnpm check` clean; tests 103 passing.

## Retro

- **Shipped:** the first read path on the ledger; a CQRS-flavored segregated query port without dragging in a query framework. The cursor format is also reusable shape if FEAT-006's consolidation ever surfaces a "snapshots paged by `(asOf, throughSeq)`" endpoint.
- **Decisions held (durable):** (1) **validation lives in the use case**, not the controller — any caller (HTTP today, CLI/batch tomorrow) inherits the same rule. (2) **Opaque cursor** over offset — append-only data; constant-cost paging; no schema leak. (3) **Controller in `ledger/infrastructure/http/`** even though the URL prefix is `/accounts/:id/` — URL prefix doesn't dictate context ownership; the ledger owns the postings.
- **Punted (intentional):** total-count headers; sort directions; per-page metadata beyond `nextCursor`; cross-account list (the SRS scopes to one account); index on `(accountId, postedAt, sequence)` (the foil's data volumes don't require it; production would).
