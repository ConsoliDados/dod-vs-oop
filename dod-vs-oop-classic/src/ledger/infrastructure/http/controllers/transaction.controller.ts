import { Body, Controller, HttpCode, Inject, Param, Post } from '@nestjs/common'
import type { TransactionDto } from '../../../application/mappers/transaction.usecase.mapper'
import type { PostTransactionUseCase } from '../../../application/usecases/post-transaction.usecase'
import type { ReverseTransactionUseCase } from '../../../application/usecases/reverse-transaction.usecase'
import { POST_TRANSACTION_USE_CASE } from '../../provider/usecases/post-transaction.provider'
import { REVERSE_TRANSACTION_USE_CASE } from '../../provider/usecases/reverse-transaction.provider'
import type { PostTransactionRequest } from '../dtos/post-transaction.dto'

/**
 * HTTP surface for the ledger context (REQ-006, REQ-007). Use cases injected
 * by token. The reversal endpoint is a **named-behavior** subresource of the
 * original transaction (`POST /transactions/:id/reversals`) and returns the
 * new reversal's DTO — the original is never mutated (REQ-011, ADR-0011).
 */
@Controller('transactions')
export class TransactionController {
  constructor(
    @Inject(POST_TRANSACTION_USE_CASE)
    private readonly postTransactionUseCase: PostTransactionUseCase,
    @Inject(REVERSE_TRANSACTION_USE_CASE)
    private readonly reverseTransactionUseCase: ReverseTransactionUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  async post(@Body() body: PostTransactionRequest): Promise<TransactionDto> {
    return this.postTransactionUseCase.execute({
      reference: body.reference,
      metadata: body.metadata,
      postings: body.postings.map((posting) => ({
        accountId: posting.accountId,
        amountCents: posting.amount,
        direction: posting.direction,
      })),
    })
  }

  /** REQ-007, ADR-0011: produces a new transaction mirroring the original. */
  @Post(':id/reversals')
  @HttpCode(201)
  async reverse(@Param('id') id: string): Promise<TransactionDto> {
    return this.reverseTransactionUseCase.execute({ id })
  }
}
