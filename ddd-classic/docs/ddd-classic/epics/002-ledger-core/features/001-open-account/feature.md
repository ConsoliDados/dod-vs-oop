---
id: FEAT-001
slug: open-account
container: 002-ledger-core
mode: B
status: in-review
depends-on: []
blocks: [FEAT-002, FEAT-003]
---

# FEAT-001 — open account

## Goal

Establish the `accounts` bounded context with its first vertical slice: open a single-currency account and read it and its available balance. This is the prerequisite for any transaction posting (FEAT-002) — you cannot post double-entry without accounts to post against. It also lands the verbose-canonical pattern stack for the first time (AggregateRoot + Validator throw-based, segregated repos, TypeORM mapper, controller) so later features follow the established shape.

## Acceptance criteria

- [x] `POST /accounts` with `{ ownerId, currency }` returns 201 and the created account; `availableBalance` and `holdAmount` start at 0; a fresh UUID id is assigned (REQ-001).
- [x] `GET /accounts/:id` returns 200 with account state; returns 404 if absent or soft-deleted (REQ-002).
- [x] `GET /accounts/:id/balance` returns 200 with `availableBalance` (= 0 until postings exist) (REQ-003).
- [x] Invalid input (missing ownerId, unsupported currency) returns 422 with the SRS error shape `{ code, message, fields? }`.
- [x] `AccountAggregate` cannot be constructed in an invalid state — `AccountValidator` throws `InvalidEntityError` on the first violation (ADR-0002).
- [x] Unit tests co-located: `account.aggregate.spec.ts`, `account.validator.spec.ts` (happy + negative).
- [x] Integration test `tests/accounts/open-account.e2e.spec.ts` covers the three endpoints end-to-end (NestJS in-process).

## Scope

**In:** `AccountAggregate` + `AccountValidator`; open/read/balance use cases; `CreateAccountRepository` + `GetAccountRepository` (segregated) with TypeORM impls + `AccountTypeOrmMapper`; `AccountController` + DTOs; `AccountsModule`; wire into `AppModule`.

**Out:** holds (REQ-004/005 — later epic); balance mutation via events (FEAT-003); any ledger/transaction code.

## RPA artefacts

- `research.md` — prior art (ddd-templates core, the production reference AccountAggregate), shape decisions, ADR candidates.
- `plan.md` — concrete file-by-file task list + test plan.
- `act.md` — live task tracker (checklist pulled from `plan.md`) + closing retro.

## Branch

`feat/open-account` off `dev`.

## Open questions

- Money/balance column type in TypeORM (integer cents vs bigint) — resolved in `plan.md`; escalate to an ADR only if it turns non-trivial.
- sqlite `:memory:` datasource lifecycle for integration tests — resolved in `plan.md`.
