import type { Provider } from '@nestjs/common'
import { ListPostingsTypeOrmRepository } from '../../typeorm/repositories/list-postings.typeorm.repository'

/** NestJS DI token for the `ListPostingsRepository` query port (FEAT-005). */
export const LIST_POSTINGS_REPOSITORY = Symbol('ListPostingsRepository')

/** Binds the `ListPostingsRepository` port to its TypeORM implementation. */
export const listPostingsRepositoryProvider: Provider = {
  provide: LIST_POSTINGS_REPOSITORY,
  useClass: ListPostingsTypeOrmRepository,
}
