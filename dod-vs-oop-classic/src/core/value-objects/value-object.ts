/**
 * Abstract base class for Value Objects (Evans-style DDD).
 *
 * Throw-based: factories invoke the validator after construction; the validator
 * throws `InvalidValueObjectError` if any property is invalid. Instances are
 * always valid by construction.
 *
 * Subclass contract:
 * - `static create(...)` and `static buildExisting(props)` (asserted at runtime)
 * - Protected constructor
 * - `isEqual(other)` implemented
 */
export abstract class ValueObject<T, E extends Error> {
  protected value: T

  protected constructor(value: T) {
    const ctor = this.constructor as { create?: unknown; buildExisting?: unknown; name: string }

    if (typeof ctor.create !== 'function') {
      throw new Error(`${ctor.name} must implement static method create`)
    }
    if (typeof ctor.buildExisting !== 'function') {
      throw new Error(`${ctor.name} must implement static method buildExisting`)
    }
    this.value = value
  }

  public getValue(): T {
    return this.value
  }

  abstract isEqual(value: ValueObject<T, E>): boolean
}
