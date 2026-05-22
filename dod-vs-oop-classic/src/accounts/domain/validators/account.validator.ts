import { InvalidEntityError, InvalidPropertyError } from '../../../core/errors'
import { EntityValidator } from '../../../core/services/entity.validator'
import { ACCOUNT_STATUSES } from '../account-status'
import type { AccountAggregate } from '../entities/account.aggregate'

/**
 * Validator for {@link AccountAggregate}.
 *
 * Throw-based (ADR-0002): accumulates one error per invalid field via
 * `addError`, then throws an aggregated `InvalidEntityError` if any were
 * collected. Invoked from the aggregate constructor, so an invalid account can
 * never exist.
 */
export class AccountValidator extends EntityValidator<AccountAggregate, InvalidEntityError> {
  override validate(): void {
    this.clearErrors()
    this.validateId()
    this.validateCreatedAt()
    this.validateUpdatedAt()
    this.validateDeletedAt()
    this.validateOwnerId()
    this.validateStatus()
    this.validateCurrencyConsistency()
    this.validateHoldAmount()
    this.validateVersion()

    if (this.hasErrors()) {
      throw InvalidEntityError.forAggregate('Account', this.getErrors())
    }
  }

  private validateOwnerId(): void {
    const ownerId = this.clazz.getOwnerId()
    if (typeof ownerId !== 'string' || ownerId.trim().length === 0) {
      this.addError(new InvalidPropertyError('ownerId', 'Owner id must be a non-empty string'))
    }
  }

  private validateStatus(): void {
    const status = this.clazz.getStatus()
    if (!ACCOUNT_STATUSES.includes(status)) {
      this.addError(new InvalidPropertyError('status', `Unknown account status: ${status}`))
    }
  }

  private validateCurrencyConsistency(): void {
    const currency = this.clazz.getCurrency()
    if (this.clazz.getAvailableBalance().getCurrency() !== currency) {
      this.addError(
        new InvalidPropertyError(
          'availableBalance',
          'Available balance currency must match the account currency',
        ),
      )
    }
    if (this.clazz.getHoldAmount().getCurrency() !== currency) {
      this.addError(
        new InvalidPropertyError(
          'holdAmount',
          'Hold amount currency must match the account currency',
        ),
      )
    }
  }

  private validateHoldAmount(): void {
    if (this.clazz.getHoldAmount().isNegative()) {
      this.addError(new InvalidPropertyError('holdAmount', 'Hold amount cannot be negative'))
    }
  }

  private validateVersion(): void {
    const version = this.clazz.getVersion()
    if (!Number.isInteger(version) || version < 0) {
      this.addError(new InvalidPropertyError('version', 'Version must be a non-negative integer'))
    }
  }
}
