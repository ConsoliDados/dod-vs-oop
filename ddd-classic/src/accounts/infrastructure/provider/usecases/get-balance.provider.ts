import type { Provider } from '@nestjs/common'
import type { GetAccountRepository } from '../../../application/repositories/get-account.repository'
import { GetBalanceUseCase } from '../../../application/usecases/get-balance.usecase'
import { GET_ACCOUNT_REPOSITORY } from '../repositories/get-account.provider'

/** NestJS DI token for {@link GetBalanceUseCase}. */
export const GET_BALANCE_USE_CASE = Symbol('GetBalanceUseCase')

/** Constructs the framework-agnostic use case from its resolved port dependency. */
export const getBalanceUseCaseProvider: Provider = {
  provide: GET_BALANCE_USE_CASE,
  inject: [GET_ACCOUNT_REPOSITORY],
  useFactory: (getAccountRepository: GetAccountRepository) =>
    new GetBalanceUseCase(getAccountRepository),
}
