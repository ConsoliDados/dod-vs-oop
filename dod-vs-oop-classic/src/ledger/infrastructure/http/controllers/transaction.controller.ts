import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common'
import type { TransactionDto } from '../../../application/mappers/transaction.usecase.mapper'
import type { PostTransactionUseCase } from '../../../application/usecases/post-transaction.usecase'
import { POST_TRANSACTION_USE_CASE } from '../../provider/usecases/post-transaction.provider'
import type { PostTransactionRequest } from '../dtos/post-transaction.dto'

/** HTTP surface for the ledger context (REQ-006). Use case injected by token. */
@Controller('transactions')
export class TransactionController {
  constructor(
    @Inject(POST_TRANSACTION_USE_CASE)
    private readonly postTransactionUseCase: PostTransactionUseCase,
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
}
