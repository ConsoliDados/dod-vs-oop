import { UseCaseError } from '../../../core/use-cases/use-case'

/**
 * Thrown when an account cannot be found (absent or soft-deleted).
 * The `_NOT_FOUND` code convention maps to HTTP 404 in the exception filter.
 */
export class AccountNotFoundError extends UseCaseError {
  constructor(accountId: string) {
    super(`Account not found: ${accountId}`, 'ACCOUNT_NOT_FOUND', { accountId })
    this.name = 'AccountNotFoundError'
    Object.setPrototypeOf(this, AccountNotFoundError.prototype)
  }
}
