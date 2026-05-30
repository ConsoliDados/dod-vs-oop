import { InvalidPropertyError, InvalidValueObjectError } from '../../../core/errors'
import { Validator } from '../../../core/services/validator'
import { ValueObject } from '../../../core/value-objects/value-object'
import { Money } from '../../../shared/value-objects'

/**
 * Internal representation of a {@link BalanceSnapshot}: the consolidated balance
 * of one account as of a checkpoint. `throughSeq` is the global posting
 * `sequence` the `balance` folds in (ADR-0006).
 */
export interface BalanceSnapshotValue {
  accountId: string
  asOf: Date
  balance: Money
  throughSeq: number
}

/**
 * Immutable, append-only audit record of an account's consolidated balance as of
 * a checkpoint (ADR-0006: *the cache overwrites, the snapshot appends*). Current
 * balance = latest snapshot + Σ(postings after its `throughSeq`).
 *
 * FEAT-003 lands the **type** (smart constructor, throw-based per ADR-0002).
 * Persistence and the `ConsolidateAccountBalance` domain service that produces
 * snapshots are FEAT-006 — no repository writes this VO yet.
 */
export class BalanceSnapshot extends ValueObject<BalanceSnapshotValue, InvalidValueObjectError> {
  private validator: BalanceSnapshotValidator

  private constructor(value: BalanceSnapshotValue) {
    super(value)
    this.validator = new BalanceSnapshotValidator(this)
  }

  /** Framework-mandated factory (playbook §2). */
  static create(value: BalanceSnapshotValue): BalanceSnapshot {
    const snapshot = new BalanceSnapshot(value)
    snapshot.validator.validate()
    return snapshot
  }

  /** Framework-mandated factory (playbook §2). Rehydrates from a persisted record. */
  static buildExisting(value: BalanceSnapshotValue): BalanceSnapshot {
    return BalanceSnapshot.create(value)
  }

  public getAccountId(): string {
    return this.value.accountId
  }

  public getAsOf(): Date {
    return this.value.asOf
  }

  public getBalance(): Money {
    return this.value.balance
  }

  public getThroughSeq(): number {
    return this.value.throughSeq
  }

  public isEqual(other: ValueObject<BalanceSnapshotValue, InvalidValueObjectError>): boolean {
    const o = other.getValue()
    return (
      this.value.accountId === o.accountId &&
      this.value.asOf.getTime() === o.asOf.getTime() &&
      this.value.balance.isEqual(o.balance) &&
      this.value.throughSeq === o.throughSeq
    )
  }
}

class BalanceSnapshotValidator extends Validator<BalanceSnapshot, InvalidValueObjectError> {
  override validate(): void {
    this.clearErrors()
    const { accountId, asOf, balance, throughSeq } = this.clazz.getValue()

    if (typeof accountId !== 'string' || accountId.trim().length === 0) {
      this.addError(new InvalidPropertyError('accountId', 'Account id must be a non-empty string'))
    }
    if (!(asOf instanceof Date) || Number.isNaN(asOf.getTime())) {
      this.addError(new InvalidPropertyError('asOf', 'asOf must be a valid Date'))
    }
    if (!(balance instanceof Money)) {
      this.addError(new InvalidPropertyError('balance', 'balance must be a Money value object'))
    }
    if (!Number.isInteger(throughSeq) || throughSeq < 0) {
      this.addError(
        new InvalidPropertyError('throughSeq', 'throughSeq must be a non-negative integer'),
      )
    }

    if (this.hasErrors()) {
      throw new InvalidValueObjectError('BalanceSnapshot', this.getErrors())
    }
  }
}
