import {
  DomainError,
  type ErrorContext,
  type FlatError,
  type SerializedDomainError,
} from './domain.error'

export interface SerializedInvalidValueObjectError extends SerializedDomainError {
  valueObject: string
  errors: Array<{ error: string; property: string; message: string; stackTrace?: string }>
}

/**
 * Error aggregating multiple invalid properties of a single Value Object.
 *
 * Throw-based: the VO constructor (after validator runs) builds this and
 * throws it. Carries the full list of property errors.
 */
export class InvalidValueObjectError extends DomainError {
  constructor(
    attribute: string,
    readonly errors: DomainError[] = [],
    context?: ErrorContext,
  ) {
    super(attribute, `Invalid VO ${attribute}`, 'valueObject', context)
    this.name = InvalidValueObjectError.name
    Object.setPrototypeOf(this, InvalidValueObjectError.prototype)
  }

  public get valueObjectName(): string {
    return this.attribute
  }

  public override toJSON(): SerializedInvalidValueObjectError {
    return {
      ...super.toJSON(),
      valueObject: this.attribute,
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
    for (const e of this.errors) {
      const propertyPath = `${basePath}.${e.attribute}`
      e.setPath(propertyPath)
      flat.push({
        path: propertyPath,
        property: e.attribute,
        message: e.message,
        origin: e.getOrigin(),
        entityName: this.attribute,
      })
    }
    return flat.length > 0 ? flat : super.toFlatErrors()
  }
}
