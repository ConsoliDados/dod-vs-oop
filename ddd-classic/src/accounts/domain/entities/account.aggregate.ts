import { AggregateRoot } from '../../../core/entities/aggregate-root'
import { InvalidEntityError, InvalidPropertyError } from '../../../core/errors'
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
  lastPostedSeq: number
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
    private lastPostedSeq: number,
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
      snapshot.lastPostedSeq,
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

  public getLastPostedSeq(): number {
    return this.lastPostedSeq
  }

  /**
   * Transitions the account to `frozen` (REQ-012, ADR-0010). Legal only from
   * `active` — any other source status throws `InvalidEntityError` (ADR-0002).
   * Bumps `version` (optimistic lock) and `updatedAt`; re-validates.
   */
  public freeze(): void {
    this.assertTransition(['active'], 'frozen')
    this.status = 'frozen'
    this.version += 1
    this.updateUpdatedAt()
    this.validator.validate()
  }

  /**
   * Transitions the account back to `active` (REQ-012, ADR-0010). Legal only
   * from `frozen` — any other source status throws `InvalidEntityError`.
   */
  public activate(): void {
    this.assertTransition(['frozen'], 'active')
    this.status = 'active'
    this.version += 1
    this.updateUpdatedAt()
    this.validator.validate()
  }

  /**
   * Transitions the account to `closed` (REQ-013, ADR-0010). Legal from
   * `active` or `frozen`; `closed` is **terminal** — calling `close()` on an
   * already-closed account throws `InvalidEntityError`. The *zero-balance*
   * precondition is **not** enforced here — it spans `accounts` + `ledger` and
   * lives in `CloseAccountService` (the use case feeds the recomputed balance
   * from the `LedgerBalanceReader` ACL into the service, which then delegates
   * the transition to this method).
   */
  public close(): void {
    this.assertTransition(['active', 'frozen'], 'closed')
    this.status = 'closed'
    this.version += 1
    this.updateUpdatedAt()
    this.validator.validate()
  }

  /**
   * Guards a status transition: throws `InvalidEntityError` if the current
   * status is not in `from`. Kept private so legal transitions stay listed at
   * each behavior site (`freeze`/`activate`/`close`) rather than in a table.
   */
  private assertTransition(from: AccountStatus[], to: AccountStatus): void {
    if (!from.includes(this.status)) {
      throw InvalidEntityError.forAggregate('Account', [
        new InvalidPropertyError(
          'status',
          `Illegal transition: ${this.status} → ${to} (legal from: ${from.join(' | ')})`,
        ),
      ])
    }
  }

  /**
   * Folds a posted transaction's net effect for this account into the cached
   * `availableBalance` and advances the checkpoint (ADR-0006), driven by the
   * `TransactionPosted` handler (FEAT-003). `delta` is the signed sum of this
   * account's postings (credit +, debit −); `throughSeq` is the highest posting
   * `sequence` folded in and must advance monotonically. The cache is
   * recomputable and never the sole authority (NFR-DATA-001).
   */
  public reflectPosting(delta: Money, throughSeq: number): void {
    const errors: InvalidPropertyError[] = []
    if (delta.getCurrency() !== this.currency) {
      errors.push(
        new InvalidPropertyError(
          'availableBalance',
          `Posting currency ${delta.getCurrency()} must match account currency ${this.currency}`,
        ),
      )
    }
    if (!Number.isInteger(throughSeq) || throughSeq <= this.lastPostedSeq) {
      errors.push(
        new InvalidPropertyError(
          'lastPostedSeq',
          `throughSeq must be an integer greater than the current checkpoint ${this.lastPostedSeq}, got ${throughSeq}`,
        ),
      )
    }
    if (errors.length > 0) {
      throw InvalidEntityError.forAggregate('Account', errors)
    }

    this.availableBalance = this.availableBalance.add(delta)
    this.lastPostedSeq = throughSeq
    this.version += 1
    this.updateUpdatedAt()
    this.validator.validate()
  }

  public override toString(): string {
    return `AccountAggregate(${this.getId().getValue()})`
  }

  public override getValidator(): AccountValidator {
    return this.validator
  }
}
