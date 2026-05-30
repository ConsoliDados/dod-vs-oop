import type { Currency } from '../../../shared/value-objects'
import type { TransactionAggregate } from '../../domain/entities/transaction.aggregate'
import type { PostingDirection } from '../../domain/posting-direction'

/** Client-facing posting. `amountCents` is signed (credit +, debit −); `direction` is derived. */
export interface PostingDto {
  accountId: string
  amountCents: number
  direction: PostingDirection
  currency: Currency
}

export interface TransactionDto {
  id: string
  reference?: string
  postings: PostingDto[]
  postedAt: string
  createdAt: string
  /** Set only when this transaction is a reversal (FEAT-004, ADR-0011). */
  reversedTransactionId?: string
}

/** Domain → DTO mapper (application layer). */
export class TransactionUseCaseMapper {
  static toDto(transaction: TransactionAggregate): TransactionDto {
    const dto: TransactionDto = {
      id: transaction.getId().getValue(),
      reference: transaction.getReference(),
      postings: transaction.getPostings().map((posting) => ({
        accountId: posting.getAccountId().getValue(),
        amountCents: posting.getSignedCents(),
        direction: posting.getDirection(),
        currency: posting.getAmount().getCurrency(),
      })),
      postedAt: transaction.getPostedAt().toISOString(),
      createdAt: transaction.getCreatedAt().toISOString(),
    }
    const reversedTransactionId = transaction.getReversedTransactionId()
    if (reversedTransactionId !== undefined) {
      dto.reversedTransactionId = reversedTransactionId
    }
    return dto
  }
}
