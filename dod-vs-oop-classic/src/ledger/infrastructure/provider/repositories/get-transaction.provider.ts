import type { Provider } from '@nestjs/common'
import { GetTransactionTypeOrmRepository } from '../../typeorm/repositories/get-transaction.typeorm.repository'

/** NestJS DI token for the `GetTransactionRepository` port. */
export const GET_TRANSACTION_REPOSITORY = Symbol('GetTransactionRepository')

/** Binds the `GetTransactionRepository` port to its TypeORM implementation. */
export const getTransactionRepositoryProvider: Provider = {
  provide: GET_TRANSACTION_REPOSITORY,
  useClass: GetTransactionTypeOrmRepository,
}
