import { UseCaseError } from '../../../core/use-cases/use-case'
import type { AccountLookupStatus } from '../ports/account-lookup.port'

/**
 * Thrown by `PostTransactionUseCase` when a referenced account is not `active`
 * (frozen or closed) — REQ-006 *active* precondition (FEAT-007, ADR-0010).
 *
 * Distinct from `InvalidEntityError` (which covers structural invariants of
 * the transaction aggregate). Ledger-local — the `ledger` never imports from
 * `accounts/application`. Maps to **422** via the `DomainExceptionFilter`
 * (code has no `_NOT_FOUND` suffix).
 */
export class AccountNotActiveError extends UseCaseError {
  constructor(accountId: string, status: AccountLookupStatus) {
    super(
      `Account ${accountId} cannot be posted to: status is ${status}, must be active`,
      'ACCOUNT_NOT_ACTIVE',
      { accountId, status },
    )
    this.name = 'AccountNotActiveError'
    Object.setPrototypeOf(this, AccountNotActiveError.prototype)
  }
}
