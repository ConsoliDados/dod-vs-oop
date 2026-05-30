import type { Identifier } from '../../shared/value-objects/identifier'
import { Validator } from '../services/validator'
import { ValueObject } from '../value-objects/value-object'

export type ValidatorEntity<TValidator> =
  TValidator extends Validator<
    infer T,
    // biome-ignore lint/suspicious/noExplicitAny: Required for type inference
    any
  >
    ? T
    : never

export type ValidatorError<TValidator> =
  TValidator extends Validator<
    // biome-ignore lint/suspicious/noExplicitAny: Required for type inference
    any,
    infer E
  >
    ? E
    : never

/**
 * Abstract base class for Entities (Evans-style DDD).
 *
 * Throw-based: subclasses' factories invoke the validator inside the
 * constructor or right after; if validation fails, the validator throws an
 * `InvalidEntityError` aggregating all collected errors. The instance never
 * exists in an invalid state.
 *
 * Subclass contract:
 * - `static create(...args)` and `static buildExisting(props)` (asserted at runtime)
 * - Protected constructor (factory-enforced)
 * - `protected validator: V` initialized in constructor
 * - `getValidator()` and `toString()` implemented
 */
export abstract class Entity<
  V extends Validator<ValidatorEntity<V>, ValidatorError<V>>,
  _E extends Error,
> {
  protected validator!: V

  protected constructor(
    protected id: Identifier,
    protected createdAt: Date,
    protected updatedAt: Date,
    protected deletedAt?: Date,
  ) {
    const ctor = this.constructor as { create?: unknown; buildExisting?: unknown; name: string }

    if (typeof ctor.create !== 'function') {
      throw new Error(`${ctor.name} must implement static method create`)
    }
    if (typeof ctor.buildExisting !== 'function') {
      throw new Error(`${ctor.name} must implement static method buildExisting`)
    }

    this.id = id
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.deletedAt = deletedAt
  }

  public getId(): Identifier {
    return this.id
  }

  public getCreatedAt(): Date {
    return this.createdAt
  }

  public getUpdatedAt(): Date {
    return this.updatedAt
  }

  public getDeletedAt(): Date | undefined {
    return this.deletedAt
  }

  public isEqual(entity: this): boolean {
    if (!(entity instanceof Entity)) return false
    const thisKeys = Object.keys(this)
    const otherKeys = Object.keys(entity)
    if (thisKeys.length !== otherKeys.length) return false

    return thisKeys.every((key) => {
      const a = this[key as keyof this]
      const b = entity[key as keyof this]
      if (a instanceof Entity && b instanceof Entity) return a.isEqual(b)
      if (a instanceof Validator && b instanceof Validator) return true
      if (a instanceof ValueObject && b instanceof ValueObject) return a.isEqual(b)
      if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
      return a === b
    })
  }

  public delete(): void {
    this.deletedAt = new Date()
    this.updateUpdatedAt()
  }

  protected updateUpdatedAt(): void {
    this.updatedAt = new Date()
  }

  public abstract toString(): string
  public abstract getValidator(): V
}
