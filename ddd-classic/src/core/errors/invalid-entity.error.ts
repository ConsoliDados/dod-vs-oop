import {
  DomainError,
  type ErrorContext,
  type FlatError,
  type SerializedDomainError,
} from './domain.error'

export interface SerializedInvalidEntityError extends SerializedDomainError {
  entity: string
  errors: Array<{ error: string; property: string; message: string; stackTrace?: string }>
  isAggregate?: boolean
}

/**
 * Error thrown when an Entity (or Aggregate Root) fails validation.
 *
 * Throw-based: the Entity constructor invokes its Validator and, if any
 * errors were accumulated, throws this aggregated error. Mirrors the
 * verbose-canonical style of the `the production reference` production codebase.
 */
export class InvalidEntityError extends DomainError {
  private readonly isAggregate: boolean

  constructor(
    attribute: string,
    readonly errors: DomainError[] = [],
    context?: ErrorContext,
    isAggregate = false,
  ) {
    super(
      attribute,
      `Invalid ${isAggregate ? 'aggregate' : 'entity'} ${attribute}`,
      isAggregate ? 'aggregate' : 'entity',
      context,
    )
    this.name = InvalidEntityError.name
    this.isAggregate = isAggregate
    Object.setPrototypeOf(this, InvalidEntityError.prototype)
  }

  public static forAggregate(
    aggregateName: string,
    errors: DomainError[] = [],
    context?: ErrorContext,
  ): InvalidEntityError {
    return new InvalidEntityError(aggregateName, errors, context, true)
  }

  public get entityName(): string {
    return this.attribute
  }

  public override toJSON(): SerializedInvalidEntityError {
    const base = super.toJSON()
    const result: SerializedInvalidEntityError = {
      ...base,
      entity: this.attribute,
      errors: this.errors.map((e) => ({
        error: e.name,
        property: e.attribute,
        message: e.message,
        ...(e.getStackTrace() ? { stackTrace: e.getStackTrace() } : {}),
      })),
    }
    if (this.isAggregate) result.isAggregate = true
    return result
  }

  public override toFlatErrors(): FlatError[] {
    const basePath = this.getPath()
    const flat: FlatError[] = []
    for (const error of this.errors) {
      const childPath = `${basePath}.${error.attribute}`
      error.setPath(childPath)
      flat.push(...error.toFlatErrors())
    }
    return flat.length > 0 ? flat : super.toFlatErrors()
  }
}
