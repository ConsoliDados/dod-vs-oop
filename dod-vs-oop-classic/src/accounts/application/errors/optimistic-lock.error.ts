import { DomainError } from '../../../core/errors/domain.error'

/**
 * Raised by `UpdateAccountRepository` impls when a concurrent write has moved
 * the row past the prior `version` carried by the in-memory aggregate (the
 * `WHERE id = ? AND version = ? - 1` guard matches zero rows).
 *
 * Greppable, structured, and distinct from `Error`: the cross-context cache
 * handler catches it specifically and swallows-and-logs rather than failing the
 * producer, because the cache is recomputable (NFR-DATA-001, ADR-0003 refined
 * for the recomputable-cache path; ADR-0006).
 */
export class OptimisticLockError extends DomainError {
  constructor(accountId: string) {
    super('version', `Optimistic lock conflict updating account ${accountId}`, 'aggregate', {
      accountId,
    })
    this.name = 'OptimisticLockError'
    Object.setPrototypeOf(this, OptimisticLockError.prototype)
  }
}
