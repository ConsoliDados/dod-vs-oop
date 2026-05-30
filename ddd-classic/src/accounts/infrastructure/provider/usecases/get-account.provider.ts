import type { Provider } from '@nestjs/common'
import type { GetAccountRepository } from '../../../application/repositories/get-account.repository'
import { GetAccountUseCase } from '../../../application/usecases/get-account.usecase'
import { GET_ACCOUNT_REPOSITORY } from '../repositories/get-account.provider'

/** NestJS DI token for {@link GetAccountUseCase}. */
export const GET_ACCOUNT_USE_CASE = Symbol('GetAccountUseCase')

/** Constructs the framework-agnostic use case from its resolved port dependency. */
export const getAccountUseCaseProvider: Provider = {
  provide: GET_ACCOUNT_USE_CASE,
  inject: [GET_ACCOUNT_REPOSITORY],
  useFactory: (getAccountRepository: GetAccountRepository) =>
    new GetAccountUseCase(getAccountRepository),
}
