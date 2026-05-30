import type { DomainError } from '../errors/domain.error'

/**
 * Abstract base class for domain object validators.
 *
 * Throw-based DDD (faithful to `the production reference`):
 * - Accumulates errors in a stack via `addError()`.
 * - `validate()` returns `void`: at the end, if `hasErrors()`, throw the
 *   appropriate aggregated error (`InvalidEntityError`,
 *   `InvalidValueObjectError`, `InvalidIdentifierError`) from the subclass
 *   override.
 *
 * Does NOT use `Result<T, E>` — this is deliberately the verbose-canonical
 * production style. The `ddd-dod/` side of the study uses the
 * Notification Pattern with `Result` — that's the point of the comparison.
 */
export abstract class Validator<T, _E extends Error> {
  protected stack: DomainError[] = []

  constructor(protected readonly clazz: T) {}

  /**
   * Validates the domain object. Throws on failure.
   *
   * Subclass pattern:
   * 1. `this.clearErrors()`
   * 2. Run all checks accumulating with `addError()`
   * 3. If `this.hasErrors()`, throw the aggregated error
   */
  abstract validate(): void

  public hasErrors(): boolean {
    return this.stack.length > 0
  }

  public getErrors(): DomainError[] {
    return this.stack
  }

  public addError(error: DomainError): void {
    this.stack.push(error)
  }

  public addErrors(errors: DomainError[]): void {
    this.stack.push(...errors)
  }

  public clearErrors(): void {
    this.stack = []
  }
}
