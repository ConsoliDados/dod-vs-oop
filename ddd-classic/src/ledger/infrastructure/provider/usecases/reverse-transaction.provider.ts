import type { Provider } from '@nestjs/common'
import type { EventBus } from '../../../../shared/application/event-bus'
import { EVENT_BUS } from '../../../../shared/infrastructure/event-bus/event-bus.provider'
import type { AccountLookup } from '../../../application/ports/account-lookup.port'
import type { CreateTransactionRepository } from '../../../application/repositories/create-transaction.repository'
import type { GetTransactionRepository } from '../../../application/repositories/get-transaction.repository'
import { ReverseTransactionUseCase } from '../../../application/usecases/reverse-transaction.usecase'
import { ACCOUNT_LOOKUP } from '../acl/account-lookup.provider'
import { CREATE_TRANSACTION_REPOSITORY } from '../repositories/create-transaction.provider'
import { GET_TRANSACTION_REPOSITORY } from '../repositories/get-transaction.provider'

/** NestJS DI token for {@link ReverseTransactionUseCase}. */
export const REVERSE_TRANSACTION_USE_CASE = Symbol('ReverseTransactionUseCase')

export const reverseTransactionUseCaseProvider: Provider = {
  provide: REVERSE_TRANSACTION_USE_CASE,
  inject: [GET_TRANSACTION_REPOSITORY, CREATE_TRANSACTION_REPOSITORY, ACCOUNT_LOOKUP, EVENT_BUS],
  useFactory: (
    getTransaction: GetTransactionRepository,
    createTransaction: CreateTransactionRepository,
    accountLookup: AccountLookup,
    eventBus: EventBus,
  ) => new ReverseTransactionUseCase(getTransaction, createTransaction, accountLookup, eventBus),
}
