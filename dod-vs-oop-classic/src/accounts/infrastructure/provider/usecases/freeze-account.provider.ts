import type { Provider } from '@nestjs/common'
import type { GetAccountRepository } from '../../../application/repositories/get-account.repository'
import type { UpdateAccountRepository } from '../../../application/repositories/update-account.repository'
import { FreezeAccountUseCase } from '../../../application/usecases/freeze-account.usecase'
import { GET_ACCOUNT_REPOSITORY } from '../repositories/get-account.provider'
import { UPDATE_ACCOUNT_REPOSITORY } from '../repositories/update-account.provider'

/** NestJS DI token for {@link FreezeAccountUseCase}. */
export const FREEZE_ACCOUNT_USE_CASE = Symbol('FreezeAccountUseCase')

export const freezeAccountUseCaseProvider: Provider = {
  provide: FREEZE_ACCOUNT_USE_CASE,
  inject: [GET_ACCOUNT_REPOSITORY, UPDATE_ACCOUNT_REPOSITORY],
  useFactory: (getAccount: GetAccountRepository, updateAccount: UpdateAccountRepository) =>
    new FreezeAccountUseCase(getAccount, updateAccount),
}
