import type { Identifier } from '../../shared/value-objects/identifier'
import { InvalidIdentifierError, InvalidPropertyError } from '../errors'
import { Validator } from './validator'

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export class IdentifierValidator extends Validator<Identifier, InvalidIdentifierError> {
  override validate(): void {
    this.clearErrors()
    const value = this.clazz.getValue()
    if (!value || !UUID_REGEX.test(value)) {
      this.addError(
        new InvalidPropertyError('id', 'The provided ID does not match the UUID format.'),
      )
    }
    if (this.hasErrors()) {
      throw new InvalidIdentifierError('ID', this.getErrors())
    }
  }
}
