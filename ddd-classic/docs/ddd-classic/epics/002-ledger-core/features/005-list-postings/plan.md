# FEAT-005 list-postings — Plan

RPA stage 2 (condensed).

## A. Application — port + cursor codec + mapper + use case

1. `application/repositories/list-postings.repository.ts` — port + `ListPostingsRepository.Input` (`accountId`, `from?`, `to?`, `limit`, `cursor?` decoded as `{ postedAt: Date, sequence: number } | undefined`) + `Output` (`{ items: PostingListItem[], nextCursor?: { postedAt: Date, sequence: number } }`).
2. `application/mappers/posting-list.mapper.ts` — `PostingListItem` (extends `PostingDto` with `postedAt`, `sequence`, `transactionId`). No domain → DTO mapper today (the projection comes straight from the repo as plain data); declared as a type only.
3. `application/cursor.ts` — pure helpers `encodeCursor` / `decodeCursor` (`base64(postedAt.toISOString() + '|' + sequence)`); invalid cursor throws a `UseCaseError` → 422.
4. `application/usecases/list-postings.usecase.ts` — `QueryUseCase<ListPostings.Input, ListPostings.Output>`:
   - validate `limit` (1..200) and `from <= to` if both → throw `InvalidPropertyError`-style → 422
   - `accountLookup.findById(id)` → 404 `TransactionAccountNotFoundError` if absent
   - decode `cursor` if present
   - delegate to `ListPostingsRepository.list`
   - encode `nextCursor` if returned
   - return `{ items, nextCursor? }`

## B. Infrastructure — query repo + providers + controller + module

5. `infrastructure/typeorm/repositories/list-postings.typeorm.repository.ts` — uses `createQueryBuilder('p')`, filters `p.accountId = :id`, optional `p.postedAt >= :from`, `p.postedAt <= :to`, cursor tuple compare, `ORDER BY p.postedAt ASC, p.sequence ASC`, `take(limit + 1)`. Maps rows to `PostingListItem`; emits `nextCursor` from the (limit+1)-th row if present.
6. `infrastructure/provider/repositories/list-postings.provider.ts` — Symbol token + useClass.
7. `infrastructure/provider/usecases/list-postings.provider.ts` — Symbol + useFactory(AccountLookup, ListPostingsRepository).
8. `infrastructure/http/controllers/account-postings.controller.ts` — `@Get('accounts/:id/postings')` reads query params + delegates; encodes/decodes cursor at the boundary.
9. `ledger.module.ts` — register both providers + add the controller.

## C. Tests
10. `tests/ledger/list-postings.e2e.spec.ts`:
    - empty list (no postings on a fresh account)
    - 3 transactions → 6 postings → list returns all in `(postedAt, sequence)` order
    - window filter (`from`/`to` mid-range)
    - pagination across 2 pages with `limit=2`; `nextCursor` round-trip; final page has no `nextCursor`
    - 404 on unknown account id
    - 422 on `limit=0` and `from > to`
11. `pnpm check` + `pnpm test` green.

## D. Docs
12. SDD-ledger §3 row + §6 port row + §7 REQ-008 ✅; epic README progress + exit check; `act.md` retro; `src/ledger/AGENTS.md` layout.
