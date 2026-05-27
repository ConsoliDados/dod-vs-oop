import type { Provider } from '@nestjs/common'
import { OnTransactionPostedHandler } from '../../../application/handlers/on-transaction-posted.handler'
import type { GetAccountRepository } from '../../../application/repositories/get-account.repository'
import type { UpdateAccountRepository } from '../../../application/repositories/update-account.repository'
import { GET_ACCOUNT_REPOSITORY } from '../repositories/get-account.provider'
import { UPDATE_ACCOUNT_REPOSITORY } from '../repositories/update-account.provider'

/** NestJS DI token for {@link OnTransactionPostedHandler}. */
export const ON_TRANSACTION_POSTED_HANDLER = Symbol('OnTransactionPostedHandler')

/** Constructs the framework-agnostic handler from its resolved port dependencies. */
export const onTransactionPostedHandlerProvider: Provider = {
  provide: ON_TRANSACTION_POSTED_HANDLER,
  inject: [GET_ACCOUNT_REPOSITORY, UPDATE_ACCOUNT_REPOSITORY],
  useFactory: (getAccount: GetAccountRepository, updateAccount: UpdateAccountRepository) =>
    new OnTransactionPostedHandler(getAccount, updateAccount),
}
