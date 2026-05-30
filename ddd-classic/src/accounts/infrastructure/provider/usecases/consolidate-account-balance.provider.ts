import type { Provider } from '@nestjs/common'
import type { AppendBalanceSnapshotRepository } from '../../../application/ports/append-balance-snapshot.repository'
import type { GetLatestBalanceSnapshotRepository } from '../../../application/ports/get-latest-balance-snapshot.repository'
import type { LedgerBalanceReader } from '../../../application/ports/ledger-balance-reader.port'
import type { GetAccountRepository } from '../../../application/repositories/get-account.repository'
import { ConsolidateAccountBalanceUseCase } from '../../../application/usecases/consolidate-account-balance.usecase'
import { LEDGER_BALANCE_READER } from '../acl/ledger-balance-reader.provider'
import { APPEND_BALANCE_SNAPSHOT_REPOSITORY } from '../repositories/append-balance-snapshot.provider'
import { GET_ACCOUNT_REPOSITORY } from '../repositories/get-account.provider'
import { GET_LATEST_BALANCE_SNAPSHOT_REPOSITORY } from '../repositories/get-latest-balance-snapshot.provider'

/** NestJS DI token for {@link ConsolidateAccountBalanceUseCase}. */
export const CONSOLIDATE_ACCOUNT_BALANCE_USE_CASE = Symbol('ConsolidateAccountBalanceUseCase')

export const consolidateAccountBalanceUseCaseProvider: Provider = {
  provide: CONSOLIDATE_ACCOUNT_BALANCE_USE_CASE,
  inject: [
    GET_ACCOUNT_REPOSITORY,
    LEDGER_BALANCE_READER,
    GET_LATEST_BALANCE_SNAPSHOT_REPOSITORY,
    APPEND_BALANCE_SNAPSHOT_REPOSITORY,
  ],
  useFactory: (
    getAccount: GetAccountRepository,
    ledgerBalanceReader: LedgerBalanceReader,
    getLatestSnapshot: GetLatestBalanceSnapshotRepository,
    appendSnapshot: AppendBalanceSnapshotRepository,
  ) =>
    new ConsolidateAccountBalanceUseCase(
      getAccount,
      ledgerBalanceReader,
      getLatestSnapshot,
      appendSnapshot,
    ),
}
