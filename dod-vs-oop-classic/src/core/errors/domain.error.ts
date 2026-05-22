/**
 * Context metadata for domain errors
 */
export interface ErrorContext {
  [key: string]: unknown
}

/**
 * Error origin classification
 */
export type ErrorOrigin = 'property' | 'entity' | 'aggregate' | 'valueObject'

/**
 * Flat error for client consumption
 */
export interface FlatError {
  path: string
  property: string
  message: string
  origin: ErrorOrigin
  entityName?: string
}

/**
 * Serialized format for JSON
 */
export interface SerializedDomainError {
  name: string
  message: string
  attribute: string
  origin: ErrorOrigin
  path?: string
  timestamp?: string
  stackTrace?: string
  context?: ErrorContext
}

/**
 * Base class for all domain errors.
 *
 * Throw-based DDD (estilo verbose-canonical do `the production reference`):
 * Validators acumulam erros mas o constructor da Entity/AggregateRoot lança
 * `InvalidEntityError` na primeira instanciação inválida.
 */
export class DomainError extends Error {
  private readonly _timestamp: Date
  private readonly _stackTrace: string | undefined
  private _context: ErrorContext
  private _path?: string

  constructor(
    public readonly attribute: string,
    message: string,
    protected readonly origin: ErrorOrigin = 'property',
    context?: ErrorContext,
  ) {
    super(message)
    this.name = 'DomainError'
    this._timestamp = new Date()

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
    this._stackTrace = this.stack

    this._context = context ?? {}
    this._path = attribute

    Object.setPrototypeOf(this, new.target.prototype)
  }

  public getTimestamp(): Date {
    return new Date(this._timestamp)
  }

  public getStackTrace(): string | undefined {
    return this._stackTrace
  }

  public getContext(): Readonly<ErrorContext> {
    return { ...this._context }
  }

  public setContext(context: ErrorContext): void {
    this._context = { ...this._context, ...context }
  }

  public getOrigin(): ErrorOrigin {
    return this.origin
  }

  public getPath(): string {
    return this._path ?? this.attribute
  }

  public setPath(path: string): void {
    this._path = path
  }

  public toJSON(): SerializedDomainError {
    const base: SerializedDomainError = {
      name: this.name,
      message: this.message,
      attribute: this.attribute,
      origin: this.origin,
      path: this.getPath(),
      timestamp: this._timestamp.toISOString(),
    }
    if (this._stackTrace) base.stackTrace = this._stackTrace
    if (Object.keys(this._context).length > 0) base.context = this._context
    return base
  }

  public toFlatErrors(): FlatError[] {
    return [
      {
        path: this.getPath(),
        property: this.attribute,
        message: this.message,
        origin: this.origin,
      },
    ]
  }

  public override toString(): string {
    return JSON.stringify(this.toJSON(), null, 2)
  }
}
