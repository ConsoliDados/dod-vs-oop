import type { Provider } from '@nestjs/common'
import { GetAccountTypeOrmRepository } from '../../typeorm/repositories/get-account.typeorm.repository'

/** NestJS DI token for the `GetAccountRepository` port. */
export const GET_ACCOUNT_REPOSITORY = Symbol('GetAccountRepository')

/** Binds the `GetAccountRepository` port to its TypeORM implementation. */
export const getAccountRepositoryProvider: Provider = {
  provide: GET_ACCOUNT_REPOSITORY,
  useClass: GetAccountTypeOrmRepository,
}
