import { InvalidEntityError, InvalidPropertyError } from '../../../core/errors'
import { EntityValidator } from '../../../core/services/entity.validator'
import type { Posting } from '../entities/posting.entity'

/**
 * Validator for {@link Posting}. Throw-based (ADR-0002): a posting must move a
 * non-zero amount; identity/currency validity is already guaranteed by the
 * `Identifier` / `Money` VOs at construction.
 */
export class PostingValidator extends EntityValidator<Posting, InvalidEntityError> {
  override validate(): void {
    this.clearErrors()
    this.validateId()
    this.validateCreatedAt()
    this.validateUpdatedAt()
    this.validateAmount()

    if (this.hasErrors()) {
      throw new InvalidEntityError('Posting', this.getErrors())
    }
  }

  private validateAmount(): void {
    if (this.clazz.getAmount().isZero()) {
      this.addError(new InvalidPropertyError('amount', 'Posting amount must be non-zero'))
    }
  }
}
