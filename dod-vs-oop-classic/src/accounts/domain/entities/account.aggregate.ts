import { AggregateRoot } from '../../../core/entities/aggregate-root'
import type { InvalidEntityError } from '../../../core/errors'
import { type Currency, Identifier, Money } from '../../../shared/value-objects'
import type { AccountStatus } from '../account-status'
import { AccountOpenedEvent } from '../events/account-opened.event'
import { AccountValidator } from '../validators/account.validator'

/**
 * Trusted reconstruction shape for {@link AccountAggregate.buildExisting},
 * produced by the TypeORM mapper from a persisted row. Balances are carried as
 * integer minor units (cents) to mirror the persistence column (ADR-0004).
 */
export interface AccountSnapshot {
  id: string
  ownerId: string
  currency: Currency
  status: AccountStatus
  availableBalanceCents: number
  holdAmountCents: number
  version: number
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}

/**
 * Account aggregate root — a single-currency holder of balance (SRS glossary).
 *
 * Invariants (enforced by {@link AccountValidator}, throw-based per ADR-0002):
 * - `ownerId` is a non-empty string.
 * - `status` is one of `active | frozen | closed`.
 * - `availableBalance` and `holdAmount` share the account's currency.
 * - `holdAmount` is non-negative; `version` is a non-negative integer.
 *
 * Emits {@link AccountOpenedEvent} on `create`. Holds lifecycle (place/release)
 * and balance mutation via ledger events are out of scope for FEAT-001;
 * `availableBalance`/`holdAmount` start at zero and only `active` is produced.
 */
export class AccountAggregate extends AggregateRoot<AccountValidator, InvalidEntityError> {
  private constructor(
    id: Identifier,
    private readonly ownerId: string,
    private readonly currency: Currency,
    private status: AccountStatus,
    private availableBalance: Money,
    private holdAmount: Money,
    private version: number,
    createdAt: Date,
    updatedAt: Date,
    deletedAt?: Date,
  ) {
    super(id, createdAt, updatedAt, deletedAt)
    this.validator = new AccountValidator(this)
    this.validator.validate()
  }

  /** Opens a fresh account: zero balances, `active`, version 0; emits `AccountOpened`. */
  static create(ownerId: string, currency: Currency): AccountAggregate {
    const now = new Date()
    const account = new AccountAggregate(
      Identifier.create(),
      ownerId,
      currency,
      'active',
      Money.zero(currency),
      Money.zero(currency),
      0,
      now,
      now,
    )
    account.addDomainEvent(new AccountOpenedEvent(account.getId().getValue(), ownerId, currency))
    return account
  }

  /** Rehydrates from a trusted persisted snapshot; re-validates (cheap guard against corrupt rows). */
  static buildExisting(snapshot: AccountSnapshot): AccountAggregate {
    return new AccountAggregate(
      Identifier.buildExisting(snapshot.id),
      snapshot.ownerId,
      snapshot.currency,
      snapshot.status,
      Money.fromCents(snapshot.availableBalanceCents, snapshot.currency),
      Money.fromCents(snapshot.holdAmountCents, snapshot.currency),
      snapshot.version,
      snapshot.createdAt,
      snapshot.updatedAt,
      snapshot.deletedAt,
    )
  }

  public getOwnerId(): string {
    return this.ownerId
  }

  public getCurrency(): Currency {
    return this.currency
  }

  public getStatus(): AccountStatus {
    return this.status
  }

  public getAvailableBalance(): Money {
    return this.availableBalance
  }

  public getHoldAmount(): Money {
    return this.holdAmount
  }

  public getVersion(): number {
    return this.version
  }

  public override toString(): string {
    return `AccountAggregate(${this.getId().getValue()})`
  }

  public override getValidator(): AccountValidator {
    return this.validator
  }
}
