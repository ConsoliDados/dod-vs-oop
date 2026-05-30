import { DomainError, type ErrorContext } from './domain.error'

/**
 * Error for a single invalid property.
 *
 * Auto-formats message as `Invalid property "{attribute}": {message}`.
 */
export class InvalidPropertyError extends DomainError {
  constructor(
    attribute: string,
    override readonly message: string,
    context?: ErrorContext,
  ) {
    super(attribute, `Invalid property "${attribute}": ${message}`, 'property', context)
    this.name = InvalidPropertyError.name
    Object.setPrototypeOf(this, InvalidPropertyError.prototype)
  }
}
