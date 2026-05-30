import type { Provider } from '@nestjs/common'
import { CreateAccountTypeOrmRepository } from '../../typeorm/repositories/create-account.typeorm.repository'

/** NestJS DI token for the `CreateAccountRepository` port (interfaces have no runtime identity). */
export const CREATE_ACCOUNT_REPOSITORY = Symbol('CreateAccountRepository')

/** Binds the `CreateAccountRepository` port to its TypeORM implementation. */
export const createAccountRepositoryProvider: Provider = {
  provide: CREATE_ACCOUNT_REPOSITORY,
  useClass: CreateAccountTypeOrmRepository,
}
