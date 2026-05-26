import { UseCaseError } from '../../../core/use-cases/use-case'

/**
 * Thrown when a transaction references an account that does not exist
 * (or is soft-deleted). The `_NOT_FOUND` code convention maps to HTTP 404.
 * Ledger-local (the `ledger` does not import `accounts/application`).
 */
export class TransactionAccountNotFoundError extends UseCaseError {
  constructor(accountId: string) {
    super(`Account not found: ${accountId}`, 'ACCOUNT_NOT_FOUND', { accountId })
    this.name = 'TransactionAccountNotFoundError'
    Object.setPrototypeOf(this, TransactionAccountNotFoundError.prototype)
  }
}
