import * as crypto from 'node:crypto'
import { InvalidIdentifierError } from '../../core/errors'
import { IdentifierValidator } from '../../core/services/identifier.validator'
import { ValueObject } from '../../core/value-objects/value-object'

/**
 * UUID-based identifier Value Object.
 *
 * Throw-based:
 * - `create()` generates a fresh UUID (always valid).
 * - `buildExisting(value)` validates via `IdentifierValidator` which throws
 *   `InvalidIdentifierError` on malformed UUID.
 */
export class Identifier extends ValueObject<string, InvalidIdentifierError> {
  private validator: IdentifierValidator

  private constructor(value: string) {
    super(value)
    this.validator = new IdentifierValidator(this)
  }

  public validate(): void {
    this.validator.validate()
  }

  static create(): Identifier {
    if (typeof crypto.randomUUID !== 'function') {
      throw new InvalidIdentifierError('ID')
    }
    return new Identifier(crypto.randomUUID())
  }

  static buildExisting(value: string): Identifier {
    if (!value) {
      throw new InvalidIdentifierError('ID')
    }
    const id = new Identifier(value)
    id.validate()
    return id
  }

  isEqual(other: Identifier): boolean {
    return this.getValue() === other.getValue()
  }
}
