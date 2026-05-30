import { Entity } from '../../../core/entities/entity'
import type { InvalidEntityError } from '../../../core/errors'
import { type Currency, Identifier, Money } from '../../../shared/value-objects'
import { directionOf, type PostingDirection } from '../posting-direction'
import { PostingValidator } from '../validators/posting.validator'

/**
 * Trusted reconstruction shape for {@link Posting.buildExisting}, produced by
 * the TypeORM mapper. `amountCents` is **signed** (credit +, debit −) and
 * `sequence` is the global monotonic order assigned at persistence (the
 * ADR-0006 balance checkpoint key, `throughSeq`).
 */
export interface PostingSnapshot {
  id: string
  accountId: string
  amountCents: number
  currency: Currency
  postedAt: Date
  sequence: number
  createdAt: Date
  updatedAt: Date
}

/**
 * A single immutable debit or credit against one account, belonging to a
 * transaction (SRS glossary; REQ-011 immutability). Non-root entity inside
 * {@link TransactionAggregate}. Holds a **signed** `Money` (credit +, debit −).
 *
 * **Getters-only by design, not anemic.** A posting is a historical fact: once
 * written it is never changed (REQ-011), so it exposes no state-mutating behavior
 * — the immutability *is* the domain rule, not a missing feature. See
 * `docs/.../architecture/sdds/sdd-ledger.md` §4 (invariant 6) and SRS REQ-011.
 */
export class Posting extends Entity<PostingValidator, InvalidEntityError> {
  private constructor(
    id: Identifier,
    private readonly accountId: Identifier,
    private readonly amount: Money,
    private readonly postedAt: Date,
    private readonly sequence: number | undefined,
    createdAt: Date,
    updatedAt: Date,
    deletedAt?: Date,
  ) {
    super(id, createdAt, updatedAt, deletedAt)
    this.validator = new PostingValidator(this)
    this.validator.validate()
  }

  /** New posting (fresh id; `sequence` assigned later at persistence). `amount` is signed. */
  static create(accountId: Identifier, amount: Money, postedAt: Date): Posting {
    return new Posting(
      Identifier.create(),
      accountId,
      amount,
      postedAt,
      undefined,
      postedAt,
      postedAt,
    )
  }

  static buildExisting(snapshot: PostingSnapshot): Posting {
    return new Posting(
      Identifier.buildExisting(snapshot.id),
      Identifier.buildExisting(snapshot.accountId),
      Money.fromCents(snapshot.amountCents, snapshot.currency),
      snapshot.postedAt,
      snapshot.sequence,
      snapshot.createdAt,
      snapshot.updatedAt,
    )
  }

  public getAccountId(): Identifier {
    return this.accountId
  }

  public getAmount(): Money {
    return this.amount
  }

  /** Signed minor units (credit +, debit −). */
  public getSignedCents(): number {
    return this.amount.getCents()
  }

  public getDirection(): PostingDirection {
    return directionOf(this.amount.getCents())
  }

  public getPostedAt(): Date {
    return this.postedAt
  }

  /** Global monotonic order; `undefined` until persisted. */
  public getSequence(): number | undefined {
    return this.sequence
  }

  public override toString(): string {
    return `Posting(${this.getId().getValue()})`
  }

  public override getValidator(): PostingValidator {
    return this.validator
  }
}
