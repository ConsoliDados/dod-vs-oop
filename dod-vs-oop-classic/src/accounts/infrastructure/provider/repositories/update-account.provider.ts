import type { Provider } from '@nestjs/common'
import { UpdateAccountTypeOrmRepository } from '../../typeorm/repositories/update-account.typeorm.repository'

/** NestJS DI token for the `UpdateAccountRepository` port. */
export const UPDATE_ACCOUNT_REPOSITORY = Symbol('UpdateAccountRepository')

/** Binds the `UpdateAccountRepository` port to its TypeORM implementation. */
export const updateAccountRepositoryProvider: Provider = {
  provide: UPDATE_ACCOUNT_REPOSITORY,
  useClass: UpdateAccountTypeOrmRepository,
}
