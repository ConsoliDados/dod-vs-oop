import type { Provider } from '@nestjs/common'
import { CreateTransactionTypeOrmRepository } from '../../typeorm/repositories/create-transaction.typeorm.repository'

/** NestJS DI token for the `CreateTransactionRepository` port. */
export const CREATE_TRANSACTION_REPOSITORY = Symbol('CreateTransactionRepository')

/** Binds the `CreateTransactionRepository` port to its TypeORM implementation. */
export const createTransactionRepositoryProvider: Provider = {
  provide: CREATE_TRANSACTION_REPOSITORY,
  useClass: CreateTransactionTypeOrmRepository,
}
