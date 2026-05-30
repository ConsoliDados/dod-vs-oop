import type { Provider } from '@nestjs/common'
import { GetLatestBalanceSnapshotTypeOrmRepository } from '../../typeorm/repositories/get-latest-balance-snapshot.typeorm.repository'

/** NestJS DI token for the `GetLatestBalanceSnapshotRepository` port (FEAT-006). */
export const GET_LATEST_BALANCE_SNAPSHOT_REPOSITORY = Symbol('GetLatestBalanceSnapshotRepository')

export const getLatestBalanceSnapshotRepositoryProvider: Provider = {
  provide: GET_LATEST_BALANCE_SNAPSHOT_REPOSITORY,
  useClass: GetLatestBalanceSnapshotTypeOrmRepository,
}
