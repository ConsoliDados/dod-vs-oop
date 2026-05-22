import type { Provider } from '@nestjs/common'
import type { EventBus } from '../../../../shared/application/event-bus'
import { EVENT_BUS } from '../../../../shared/infrastructure/event-bus/event-bus.provider'
import type { CreateAccountRepository } from '../../../application/repositories/create-account.repository'
import { OpenAccountUseCase } from '../../../application/usecases/open-account.usecase'
import { CREATE_ACCOUNT_REPOSITORY } from '../repositories/create-account.provider'

/** NestJS DI token for {@link OpenAccountUseCase}. */
export const OPEN_ACCOUNT_USE_CASE = Symbol('OpenAccountUseCase')

/** Constructs the framework-agnostic use case from its resolved port dependencies. */
export const openAccountUseCaseProvider: Provider = {
  provide: OPEN_ACCOUNT_USE_CASE,
  inject: [CREATE_ACCOUNT_REPOSITORY, EVENT_BUS],
  useFactory: (createAccountRepository: CreateAccountRepository, eventBus: EventBus) =>
    new OpenAccountUseCase(createAccountRepository, eventBus),
}
