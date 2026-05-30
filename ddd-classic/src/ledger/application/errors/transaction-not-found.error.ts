import { UseCaseError } from '../../../core/use-cases/use-case'

/**
 * Thrown when an operation references a transaction id that does not exist
 * (e.g. reversing an unknown transaction — FEAT-004). The `_NOT_FOUND` code
 * convention maps to **404** via `DomainExceptionFilter`. Distinct from
 * `TransactionAccountNotFoundError` (which targets the *account* referenced by
 * a posting).
 */
export class TransactionNotFoundError extends UseCaseError {
  constructor(transactionId: string) {
    super(`Transaction not found: ${transactionId}`, 'TRANSACTION_NOT_FOUND', {
      transactionId,
    })
    this.name = 'TransactionNotFoundError'
    Object.setPrototypeOf(this, TransactionNotFoundError.prototype)
  }
}
