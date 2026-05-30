import type { Provider } from '@nestjs/common'
import { AppendBalanceSnapshotTypeOrmRepository } from '../../typeorm/repositories/append-balance-snapshot.typeorm.repository'

/** NestJS DI token for the `AppendBalanceSnapshotRepository` port (FEAT-006). */
export const APPEND_BALANCE_SNAPSHOT_REPOSITORY = Symbol('AppendBalanceSnapshotRepository')

export const appendBalanceSnapshotRepositoryProvider: Provider = {
  provide: APPEND_BALANCE_SNAPSHOT_REPOSITORY,
  useClass: AppendBalanceSnapshotTypeOrmRepository,
}
