import type { Provider } from '@nestjs/common'
import type { LedgerBalanceReader } from '../../../application/ports/ledger-balance-reader.port'
import type { GetAccountRepository } from '../../../application/repositories/get-account.repository'
import type { UpdateAccountRepository } from '../../../application/repositories/update-account.repository'
import { CloseAccountUseCase } from '../../../application/usecases/close-account.usecase'
import { LEDGER_BALANCE_READER } from '../acl/ledger-balance-reader.provider'
import { GET_ACCOUNT_REPOSITORY } from '../repositories/get-account.provider'
import { UPDATE_ACCOUNT_REPOSITORY } from '../repositories/update-account.provider'

/** NestJS DI token for {@link CloseAccountUseCase}. */
export const CLOSE_ACCOUNT_USE_CASE = Symbol('CloseAccountUseCase')

export const closeAccountUseCaseProvider: Provider = {
  provide: CLOSE_ACCOUNT_USE_CASE,
  inject: [GET_ACCOUNT_REPOSITORY, UPDATE_ACCOUNT_REPOSITORY, LEDGER_BALANCE_READER],
  useFactory: (
    getAccount: GetAccountRepository,
    updateAccount: UpdateAccountRepository,
    ledgerBalanceReader: LedgerBalanceReader,
  ) => new CloseAccountUseCase(getAccount, updateAccount, ledgerBalanceReader),
}
