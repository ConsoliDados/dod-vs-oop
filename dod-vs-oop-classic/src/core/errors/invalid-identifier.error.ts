import {
  DomainError,
  type ErrorContext,
  type FlatError,
  type SerializedDomainError,
} from './domain.error'

export interface SerializedInvalidIdentifierError extends SerializedDomainError {
  identifier: string
  errors: Array<{ error: string; property: string; message: string; stackTrace?: string }>
}

/**
 * Error thrown when an Identifier fails validation.
 */
export class InvalidIdentifierError extends DomainError {
  constructor(
    attribute: string,
    readonly errors: DomainError[] = [],
    context?: ErrorContext,
  ) {
    super(attribute, `Invalid Identifier ${attribute}`, 'property', context)
    this.name = InvalidIdentifierError.name
    Object.setPrototypeOf(this, InvalidIdentifierError.prototype)
  }

  public override toJSON(): SerializedInvalidIdentifierError {
    return {
      ...super.toJSON(),
      identifier: this.attribute,
      errors: this.errors.map((e) => ({
        error: e.name,
        property: e.attribute,
        message: e.message,
        ...(e.getStackTrace() ? { stackTrace: e.getStackTrace() } : {}),
      })),
    }
  }

  public override toFlatErrors(): FlatError[] {
    const basePath = this.getPath()
    const flat: FlatError[] = []
    for (const error of this.errors) {
      const propertyPath = `${basePath}.${error.attribute}`
      error.setPath(propertyPath)
      flat.push({
        path: propertyPath,
        property: error.attribute,
        message: error.message,
        origin: error.getOrigin(),
      })
    }
    return flat.length > 0 ? flat : super.toFlatErrors()
  }
}
