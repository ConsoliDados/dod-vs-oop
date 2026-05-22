# FEAT-002 post-transaction — Act

RPA stage 3. Live task tracker (pulled from `plan.md`) + execution log + retro. Tick as work happens.

## Tasks

### 1. Domain
- [ ] `domain/posting-direction.ts` (+ signed/direction helpers)
- [ ] `domain/entities/posting.entity.ts`
- [ ] `domain/validators/posting.validator.ts`
- [ ] `domain/entities/transaction.aggregate.ts`
- [ ] `domain/validators/transaction.validator.ts`
- [ ] `domain/events/transaction-posted.event.ts`
- [ ] co-located specs (transaction aggregate + validator, posting) green

### 2. Application (framework-free)
- [ ] `application/ports/account-lookup.port.ts`
- [ ] `application/repositories/create-transaction.repository.ts`
- [ ] `application/usecases/post-transaction.usecase.ts`
- [ ] `application/mappers/transaction.usecase.mapper.ts`
- [ ] `application/errors/currency-mismatch.error.ts` + ledger-local not-found error

### 3. Infrastructure
- [ ] `infrastructure/typeorm/entities/{transaction,posting}.typeorm.entity.ts`
- [ ] `infrastructure/typeorm/mappers/transaction.typeorm.mapper.ts`
- [ ] `infrastructure/typeorm/repositories/create-transaction.typeorm.repository.ts` (atomic write + sequence)
- [ ] `infrastructure/acl/account-lookup.typeorm.ts` (ACL into accounts, read-only)
- [ ] `infrastructure/http/controllers/transaction.controller.ts` + `dtos/post-transaction.dto.ts`
- [ ] `infrastructure/provider/{usecases,repositories,acl}/*.provider.ts`

### 4. Wiring
- [ ] `infrastructure/ledger.module.ts`
- [ ] `app.module.ts` (import LedgerModule)
- [ ] `src/ledger/AGENTS.md` (module template)

### 5. Integration + close
- [ ] `tests/ledger/post-transaction.e2e.spec.ts` green (happy / unbalanced 422 / currency mismatch 422 / missing account 404 / <2 postings 422)
- [ ] draft `sdds/sdd-ledger.md`
- [ ] `pnpm check` + `pnpm test` green
- [ ] update epic `002-ledger-core/README.md` progress log

## Execution log

<!-- Append dated notes as work happens: surprises, deviations from plan, decisions. -->

- (not started — RPA cards created 2026-05-22; awaiting plan review before implementation)

## Retro

<!-- Filled when the feature ships. What shipped, what got punted, surprises. -->

- _pending_
