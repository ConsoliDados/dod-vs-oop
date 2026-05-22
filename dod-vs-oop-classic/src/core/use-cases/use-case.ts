/**
 * Base Use Case Abstract Class.
 *
 * Throw-based (verbose-canonical style from `the production reference`):
 * `execute()` returns `Promise<TResponse>` directly. Errors propagate as
 * exceptions (DomainError, InfraError, etc.). Does NOT use Result — that's
 * the point of the comparison against `dod-vs-oop-dod`, which uses
 * `@consolidados/results`.
 *
 * Subclasses implement orchestration: validate input → load aggregates via
 * repos → run domain logic → persist → publish events (via synchronous
 * EventBus, no Outbox) → return DTO.
 */
export abstract class UseCase<TRequest, TResponse> {
  abstract execute(request: TRequest): Promise<TResponse>
}

/**
 * Specialized use case for read-only queries.
 */
export abstract class QueryUseCase<TRequest, TResponse> extends UseCase<TRequest, TResponse> {
  abstract override execute(request: TRequest): Promise<TResponse>
}

/**
 * Specialized use case for write commands.
 */
export abstract class CommandUseCase<TRequest, TResponse> extends UseCase<TRequest, TResponse> {
  abstract override execute(request: TRequest): Promise<TResponse>
}

/**
 * Application-layer error base. Throw subclasses from use cases for
 * application concerns (not domain invariants).
 */
export class UseCaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'UseCaseError'
    Object.setPrototypeOf(this, UseCaseError.prototype)
  }
}
