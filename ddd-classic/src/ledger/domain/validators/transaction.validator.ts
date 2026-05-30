import { InvalidEntityError, InvalidPropertyError } from '../../../core/errors'
import { EntityValidator } from '../../../core/services/entity.validator'
import type { TransactionAggregate } from '../entities/transaction.aggregate'

const MIN_POSTINGS = 2

/**
 * Validator for {@link TransactionAggregate}. Throw-based (ADR-0002): enforces
 * the double-entry invariants intrinsic to the transaction. Account existence
 * and account↔posting currency match are cross-context and live in the use case.
 */
export class TransactionValidator extends EntityValidator<
  TransactionAggregate,
  InvalidEntityError
> {
  override validate(): void {
    this.clearErrors()
    this.validateId()
    this.validateCreatedAt()
    this.validateUpdatedAt()
    this.validatePostingCount()
    this.validateSingleCurrency()
    this.validateBalanced()
    this.validateReversedTransactionId()

    if (this.hasErrors()) {
      throw InvalidEntityError.forAggregate('Transaction', this.getErrors())
    }
  }

  private validatePostingCount(): void {
    if (this.clazz.getPostings().length < MIN_POSTINGS) {
      this.addError(
        new InvalidPropertyError(
          'postings',
          `A transaction needs at least ${MIN_POSTINGS} postings`,
        ),
      )
    }
  }

  private validateSingleCurrency(): void {
    const currencies = new Set(this.clazz.getPostings().map((p) => p.getAmount().getCurrency()))
    if (currencies.size > 1) {
      this.addError(
        new InvalidPropertyError('postings', 'All postings must share a single currency'),
      )
    }
  }

  private validateBalanced(): void {
    const postings = this.clazz.getPostings()
    if (postings.length === 0) return
    const sum = postings.reduce((acc, p) => acc + p.getSignedCents(), 0)
    if (sum !== 0) {
      this.addError(
        new InvalidPropertyError('postings', `Transaction is not balanced (Σ signed = ${sum})`),
      )
    }
  }

  /**
   * Cheap guard against a corrupt persisted value (FEAT-004): when present, the
   * link must be a non-empty uuid-shaped string. The field is internal — set by
   * `reverseOf` or `buildExisting` — so violations are unreachable in practice.
   */
  private validateReversedTransactionId(): void {
    const ref = this.clazz.getReversedTransactionId()
    if (ref === undefined) return
    if (typeof ref !== 'string' || ref.length !== 36) {
      this.addError(
        new InvalidPropertyError(
          'reversedTransactionId',
          'reversedTransactionId must be a uuid-shaped string when present',
        ),
      )
    }
  }
}
