import { CommandUseCase } from '../../../core/use-cases/use-case'
import type { EventBus } from '../../../shared/application/event-bus'
import {
  type PostingInput,
  TransactionAggregate,
} from '../../domain/entities/transaction.aggregate'
import { TransactionPostedEvent } from '../../domain/events/transaction-posted.event'
import type { PostingDirection } from '../../domain/posting-direction'
import { AccountNotActiveError } from '../errors/account-not-active.error'
import { TransactionAccountNotFoundError } from '../errors/transaction-account-not-found.error'
import {
  type TransactionDto,
  TransactionUseCaseMapper,
} from '../mappers/transaction.usecase.mapper'
import type { AccountLookup } from '../ports/account-lookup.port'
import type { CreateTransactionRepository } from '../repositories/create-transaction.repository'

export namespace PostTransaction {
  export interface PostingInput {
    accountId: string
    amountCents: number
    direction: PostingDirection
  }
  export interface Input {
    reference?: string
    metadata?: Record<string, unknown>
    postings: PostingInput[]
  }
  export type Output = TransactionDto
}

/**
 * Posts a balanced double-entry transaction (REQ-006).
 *
 * Framework-agnostic (ADR-0005). Orchestration:
 * 1. Resolve each posting's currency + `status` from its account via the
 *    `AccountLookup` port (cross-context ACL) — missing account → 404; a
 *    non-`active` referenced account → 422 (FEAT-007, ADR-0010 / REQ-006).
 * 2. Build `TransactionAggregate` — the validator throws (422) if it is not
 *    balanced, has < 2 postings, or its accounts don't share a currency
 *    (each posting's currency is its account's, so a multi-currency set of
 *    accounts surfaces as the single-currency invariant).
 * 3. Persist atomically, publish `TransactionPosted` on the EventBus, return DTO.
 */
export class PostTransactionUseCase extends CommandUseCase<
  PostTransaction.Input,
  PostTransaction.Output
> {
  constructor(
    private readonly createTransactionRepository: CreateTransactionRepository,
    private readonly accountLookup: AccountLookup,
    private readonly eventBus: EventBus,
  ) {
    super()
  }

  async execute(input: PostTransaction.Input): Promise<PostTransaction.Output> {
    const enriched: PostingInput[] = []
    for (const posting of input.postings) {
      const account = await this.accountLookup.findById(posting.accountId)
      if (!account) {
        throw new TransactionAccountNotFoundError(posting.accountId)
      }
      if (account.status !== 'active') {
        throw new AccountNotActiveError(posting.accountId, account.status)
      }
      enriched.push({
        accountId: posting.accountId,
        amountCents: posting.amountCents,
        direction: posting.direction,
        currency: account.currency,
      })
    }

    const transaction = TransactionAggregate.create({
      reference: input.reference,
      metadata: input.metadata,
      postings: enriched,
    })

    const persisted = await this.createTransactionRepository.insert(transaction)
    // Build the event from the *persisted* postings — they carry the DB-assigned
    // `sequence` the `accounts` checkpoint needs (ADR-0008).
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
