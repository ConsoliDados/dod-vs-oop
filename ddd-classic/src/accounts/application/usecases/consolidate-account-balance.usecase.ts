import { CommandUseCase } from '../../../core/use-cases/use-case'
import { ConsolidateAccountBalance } from '../../domain/services/consolidate-account-balance.service'
import { AccountNotFoundError } from '../errors/account-not-found.error'
import {
  type BalanceSnapshotDto,
  BalanceSnapshotUseCaseMapper,
} from '../mappers/balance-snapshot.usecase.mapper'
import type { AppendBalanceSnapshotRepository } from '../ports/append-balance-snapshot.repository'
import type { GetLatestBalanceSnapshotRepository } from '../ports/get-latest-balance-snapshot.repository'
import type { LedgerBalanceReader } from '../ports/ledger-balance-reader.port'
import type { GetAccountRepository } from '../repositories/get-account.repository'

export namespace ConsolidateAccountBalanceCase {
  export interface Input {
    id: string
  }
  export type Output = BalanceSnapshotDto
}

/**
 * Consolidates an account's balance into an append-only `BalanceSnapshot`
 * (FEAT-006, ADR-0006). Framework-agnostic (ADR-0005).
 *
 * Orchestration:
 * 1. Load the account (`GetAccountRepository`) → 404 if absent.
 * 2. Recompute `{ balance, throughSeq }` from the ledger via the widened
 *    `LedgerBalanceReader` ACL. **This is the authority for the snapshot
 *    contents** — never the cache (NFR-DATA-001).
 * 3. Read the latest snapshot (or null) via
 *    `GetLatestBalanceSnapshotRepository`.
 * 4. Run `ConsolidateAccountBalance`:
 *    - first snapshot → append
 *    - advancing `throughSeq` → append
 *    - same / stale `throughSeq` → **no-op**, return the prior snapshot
 *      (friendly to retries; idempotent — gate decision 2026-05-29)
 * 5. Append via `AppendBalanceSnapshotRepository` if a new snapshot was
 *    produced.
 * 6. Return the **current** snapshot DTO (newly-appended or pre-existing).
 *
 * The cache is **not** touched — `OnTransactionPostedHandler` keeps it in
 * sync delta-style (FEAT-003). The snapshot is the recovery surface.
 */
export class ConsolidateAccountBalanceUseCase extends CommandUseCase<
  ConsolidateAccountBalanceCase.Input,
  ConsolidateAccountBalanceCase.Output
> {
  private readonly consolidateService = new ConsolidateAccountBalance()

  constructor(
    private readonly getAccount: GetAccountRepository,
    private readonly ledgerBalanceReader: LedgerBalanceReader,
    private readonly getLatestSnapshot: GetLatestBalanceSnapshotRepository,
    private readonly appendSnapshot: AppendBalanceSnapshotRepository,
  ) {
    super()
  }

  async execute(
    input: ConsolidateAccountBalanceCase.Input,
  ): Promise<ConsolidateAccountBalanceCase.Output> {
    const account = await this.getAccount.findById(input.id)
    if (!account) {
      throw new AccountNotFoundError(input.id)
    }
    const ledger = await this.ledgerBalanceReader.balanceAndThroughSeqOf(
      input.id,
      account.getCurrency(),
    )
    const latest = (await this.getLatestSnapshot.findLatestByAccountId(input.id)) ?? undefined
    const result = this.consolidateService.consolidate({
      accountId: input.id,
      currency: account.getCurrency(),
      ledger,
      latest,
      now: new Date(),
    })
    if (result.appended) {
      await this.appendSnapshot.append(result.appended)
    }
    return BalanceSnapshotUseCaseMapper.toDto(result.current)
  }
}
