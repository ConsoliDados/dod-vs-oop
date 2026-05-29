import { CommandUseCase } from '../../../core/use-cases/use-case'
import type { EventBus } from '../../../shared/application/event-bus'
import { TransactionAggregate } from '../../domain/entities/transaction.aggregate'
import { TransactionPostedEvent } from '../../domain/events/transaction-posted.event'
import { AccountNotActiveError } from '../errors/account-not-active.error'
import { TransactionAccountNotFoundError } from '../errors/transaction-account-not-found.error'
import { TransactionNotFoundError } from '../errors/transaction-not-found.error'
import {
  type TransactionDto,
  TransactionUseCaseMapper,
} from '../mappers/transaction.usecase.mapper'
import type { AccountLookup } from '../ports/account-lookup.port'
import type { CreateTransactionRepository } from '../repositories/create-transaction.repository'
import type { GetTransactionRepository } from '../repositories/get-transaction.repository'

export namespace ReverseTransaction {
  export interface Input {
    id: string
  }
  export type Output = TransactionDto
}

/**
 * Reverses a posted transaction (REQ-007, FEAT-004) — produces a **new**
 * transaction with mirrored postings linked back to the original via
 * `reversedTransactionId`. The original is never mutated (REQ-011, ADR-0011).
 *
 * Framework-agnostic (ADR-0005). Orchestration:
 * 1. Load the original via `GetTransactionRepository` → 404
 *    `TRANSACTION_NOT_FOUND` if absent.
 * 2. For each posting's account, run the cross-context guard via the
 *    `AccountLookup` ACL — missing → 404 (`TransactionAccountNotFoundError`);
 *    non-`active` → 422 (`AccountNotActiveError`, reused from FEAT-007). The
 *    *active* precondition (REQ-006) applies uniformly to the reversal post.
 * 3. `TransactionAggregate.reverseOf(original)` — validator runs (mirror of a
 *    zero-sum set is zero-sum; ≥ 2 postings + single-currency carry over).
 * 4. Persist atomically via `CreateTransactionRepository`. The mirror postings
 *    get fresh DB-assigned `sequence`s.
 * 5. Build & publish `TransactionPostedEvent` from the persisted reversal
 *    (ADR-0008). The cache update flows through the existing FEAT-003
 *    `OnTransactionPostedHandler` in `accounts` — no special case, no new
 *    handler. The mirror deltas cancel the original's cached effect.
 */
export class ReverseTransactionUseCase extends CommandUseCase<
  ReverseTransaction.Input,
  ReverseTransaction.Output
> {
  constructor(
    private readonly getTransactionRepository: GetTransactionRepository,
    private readonly createTransactionRepository: CreateTransactionRepository,
    private readonly accountLookup: AccountLookup,
    private readonly eventBus: EventBus,
  ) {
    super()
  }

  async execute(input: ReverseTransaction.Input): Promise<ReverseTransaction.Output> {
    const original = await this.getTransactionRepository.findById(input.id)
    if (!original) {
      throw new TransactionNotFoundError(input.id)
    }

    for (const posting of original.getPostings()) {
      const accountId = posting.getAccountId().getValue()
      const account = await this.accountLookup.findById(accountId)
      if (!account) {
        throw new TransactionAccountNotFoundError(accountId)
      }
      if (account.status !== 'active') {
        throw new AccountNotActiveError(accountId, account.status)
      }
    }

    const reversal = TransactionAggregate.reverseOf(original)
    const persisted = await this.createTransactionRepository.insert(reversal)
    await this.eventBus.publishAll([
      new TransactionPostedEvent(
        persisted.getId().getValue(),
        persisted.getPostedAt(),
        persisted.toEntries(),
      ),
    ])
    return TransactionUseCaseMapper.toDto(persisted)
  }
}
