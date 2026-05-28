import { CommandUseCase } from '../../../core/use-cases/use-case'
import { CloseAccountService } from '../../domain/services/close-account.service'
import { AccountNotFoundError } from '../errors/account-not-found.error'
import { type AccountDto, AccountUseCaseMapper } from '../mappers/account.usecase.mapper'
import type { LedgerBalanceReader } from '../ports/ledger-balance-reader.port'
import type { GetAccountRepository } from '../repositories/get-account.repository'
import type { UpdateAccountRepository } from '../repositories/update-account.repository'

export namespace CloseAccount {
  export interface Input {
    id: string
  }
  export type Output = AccountDto
}

/**
 * Closes an account (REQ-013, ADR-0010) — the study's first domain-service-led
 * use case.
 *
 * Framework-agnostic (ADR-0005). Orchestration:
 * 1. Load the account (`GetAccountRepository`) → 404 if absent.
 * 2. **Recompute the balance from the ledger** via `LedgerBalanceReader`
 *    (accounts→ledger ACL). The cache is never trusted for an irreversible
 *    transition (NFR-DATA-001, ADR-0006).
 * 3. Hand both to `CloseAccountService` (pure domain service): non-zero
 *    balance → `AccountNotClosableError` (→ 422); zero balance → the service
 *    delegates the transition to `account.close()` (the aggregate's terminal
 *    guard fires if it's already closed → 422).
 * 4. Persist via `UpdateAccountRepository` (optimistic lock on prior `version`).
 */
export class CloseAccountUseCase extends CommandUseCase<CloseAccount.Input, CloseAccount.Output> {
  private readonly closeAccountService = new CloseAccountService()

  constructor(
    private readonly getAccount: GetAccountRepository,
    private readonly updateAccount: UpdateAccountRepository,
    private readonly ledgerBalanceReader: LedgerBalanceReader,
  ) {
    super()
  }

  async execute(input: CloseAccount.Input): Promise<CloseAccount.Output> {
    const account = await this.getAccount.findById(input.id)
    if (!account) {
      throw new AccountNotFoundError(input.id)
    }
    const ledgerBalance = await this.ledgerBalanceReader.balanceOf(input.id, account.getCurrency())
    this.closeAccountService.close(account, ledgerBalance)
    await this.updateAccount.update(account)
    return AccountUseCaseMapper.toDto(account)
  }
}
