import { UseCaseError } from '../../../core/use-cases/use-case'

/**
 * Raised by `CloseAccountService` when the account's balance recomputed from
 * the ledger postings is non-zero (REQ-013, ADR-0010). Distinct from
 * `InvalidEntityError` (illegal status transition) — the *transition* itself
 * is legal; the *precondition* is not satisfied. Maps to **422** via the
 * `DomainExceptionFilter` (no `_NOT_FOUND` suffix).
 */
export class AccountNotClosableError extends UseCaseError {
  constructor(accountId: string, balanceCents: number, currency: string) {
    super(
      `Account ${accountId} cannot be closed: ledger-recomputed balance is ${balanceCents} ${currency}, must be zero`,
      'ACCOUNT_NOT_CLOSABLE',
      { accountId, balanceCents, currency },
    )
    this.name = 'AccountNotClosableError'
    Object.setPrototypeOf(this, AccountNotClosableError.prototype)
  }
}
