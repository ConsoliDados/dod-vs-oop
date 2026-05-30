import type { Entity } from '../entities/entity'
import { InvalidPropertyError } from '../errors'
import { Validator } from './validator'

export type ValidatorFromEntity<TEntity, TError extends Error> =
  TEntity extends Entity<infer T, TError> ? T : never

/**
 * Base validator for Entities. Provides reusable `validateId/CreatedAt/UpdatedAt/DeletedAt`
 * helpers. Subclasses still implement `validate()` themselves and decide which
 * aggregated error to throw (typically `InvalidEntityError`).
 */
export abstract class EntityValidator<
  T extends Entity<ValidatorFromEntity<T, E>, E>,
  E extends Error,
> extends Validator<T, E> {
  protected validateId(): void {
    const id = this.clazz.getId()
    try {
      id.validate()
    } catch (err) {
      if (err instanceof Error) {
        this.addError(new InvalidPropertyError('id', err.message ?? 'Invalid id'))
      }
    }
  }

  protected validateCreatedAt(): void {
    const createdAt = this.clazz.getCreatedAt()
    if (!(createdAt instanceof Date)) {
      this.addError(new InvalidPropertyError('createdAt', 'CreatedAt must be a Date'))
    }
  }

  protected validateUpdatedAt(): void {
    const updatedAt = this.clazz.getUpdatedAt()
    if (!(updatedAt instanceof Date)) {
      this.addError(new InvalidPropertyError('updatedAt', 'UpdatedAt must be a Date'))
    }
  }

  protected validateDeletedAt(): void {
    const deletedAt = this.clazz.getDeletedAt()
    if (deletedAt && !(deletedAt instanceof Date)) {
      this.addError(new InvalidPropertyError('deletedAt', 'DeletedAt must be a Date'))
    }
  }
}
