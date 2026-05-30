import type { Provider } from '@nestjs/common'
import type { EventBus } from '../../../../shared/application/event-bus'
import { EVENT_BUS } from '../../../../shared/infrastructure/event-bus/event-bus.provider'
import type { AccountLookup } from '../../../application/ports/account-lookup.port'
import type { CreateTransactionRepository } from '../../../application/repositories/create-transaction.repository'
import { PostTransactionUseCase } from '../../../application/usecases/post-transaction.usecase'
import { ACCOUNT_LOOKUP } from '../acl/account-lookup.provider'
import { CREATE_TRANSACTION_REPOSITORY } from '../repositories/create-transaction.provider'

/** NestJS DI token for {@link PostTransactionUseCase}. */
export const POST_TRANSACTION_USE_CASE = Symbol('PostTransactionUseCase')

/** Constructs the framework-agnostic use case from its resolved port dependencies. */
export const postTransactionUseCaseProvider: Provider = {
  provide: POST_TRANSACTION_USE_CASE,
  inject: [CREATE_TRANSACTION_REPOSITORY, ACCOUNT_LOOKUP, EVENT_BUS],
  useFactory: (
    createTransactionRepository: CreateTransactionRepository,
    accountLookup: AccountLookup,
    eventBus: EventBus,
  ) => new PostTransactionUseCase(createTransactionRepository, accountLookup, eventBus),
}
