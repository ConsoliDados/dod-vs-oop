import { AggregateRoot } from '../../../core/entities/aggregate-root'
import type { InvalidEntityError } from '../../../core/errors'
import { type Currency, Identifier, Money } from '../../../shared/value-objects'
import { type TransactionEntry, TransactionPostedEvent } from '../events/transaction-posted.event'
import { type PostingDirection, toSignedCents } from '../posting-direction'
import { TransactionValidator } from '../validators/transaction.validator'
import { Posting, type PostingSnapshot } from './posting.entity'

/** One posting as supplied to `create` — positive magnitude + direction + the account's currency. */
export interface PostingInput {
  accountId: string
  amountCents: number
  direction: PostingDirection
  currency: Currency
}

export interface CreateTransactionInput {
  reference?: string
  metadata?: Record<string, unknown>
  postings: PostingInput[]
}

export interface TransactionSnapshot {
  id: string
  reference?: string
  metadata: Record<string, unknown>
  postedAt: Date
  postings: PostingSnapshot[]
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}

/**
 * Transaction aggregate root — a set of 2+ postings that balance exactly
 * (SRS glossary; REQ-006). The unit of consistency for a money movement and the
 * append-only source of truth (REQ-011); postings are never mutated.
 *
 * Invariants (enforced by {@link TransactionValidator}, throw-based per ADR-0002):
 * - ≥2 postings; all sharing a single currency; signed amounts sum to zero.
 *
 * Emits {@link TransactionPostedEvent} on `create`. Cross-context checks
 * (account existence + currency match) are the use case's job, not the aggregate's.
 */
export class TransactionAggregate extends AggregateRoot<TransactionValidator, InvalidEntityError> {
  private constructor(
    id: Identifier,
    private readonly reference: string | undefined,
    private readonly postings: Posting[],
    private readonly metadata: Record<string, unknown>,
    private readonly postedAt: Date,
    createdAt: Date,
    updatedAt: Date,
    deletedAt?: Date,
  ) {
    super(id, createdAt, updatedAt, deletedAt)
    this.validator = new TransactionValidator(this)
    this.validator.validate()
  }

  static create(input: CreateTransactionInput): TransactionAggregate {
    const now = new Date()
    const postings = input.postings.map((p) =>
      Posting.create(
        Identifier.buildExisting(p.accountId),
        Money.fromCents(toSignedCents(p.amountCents, p.direction), p.currency),
        now,
      ),
    )
    const transaction = new TransactionAggregate(
      Identifier.create(),
      input.reference,
      postings,
      input.metadata ?? {},
      now,
      now,
      now,
    )
    transaction.addDomainEvent(
      new TransactionPostedEvent(transaction.getId().getValue(), now, transaction.toEntries()),
    )
    return transaction
  }

  static buildExisting(snapshot: TransactionSnapshot): TransactionAggregate {
    return new TransactionAggregate(
      Identifier.buildExisting(snapshot.id),
      snapshot.reference,
      snapshot.postings.map((p) => Posting.buildExisting(p)),
      snapshot.metadata,
      snapshot.postedAt,
      snapshot.createdAt,
      snapshot.updatedAt,
      snapshot.deletedAt,
    )
  }

  public getReference(): string | undefined {
    return this.reference
  }

  public getPostings(): readonly Posting[] {
    return this.postings
  }

  public getMetadata(): Record<string, unknown> {
    return this.metadata
  }

  public getPostedAt(): Date {
    return this.postedAt
  }

  public getCurrency(): Currency {
    const first = this.postings[0]
    if (!first) {
      // Unreachable post-validation (≥2 postings); guards noUncheckedIndexedAccess.
      throw new Error('Transaction has no postings')
    }
    return first.getAmount().getCurrency()
  }

  /** Plain-data per-account effects for the `TransactionPosted` event payload. */
  public toEntries(): TransactionEntry[] {
    return this.postings.map((p) => ({
      accountId: p.getAccountId().getValue(),
      amountCents: p.getSignedCents(),
      currency: p.getAmount().getCurrency(),
    }))
  }

  public override toString(): string {
    return `TransactionAggregate(${this.getId().getValue()})`
  }

  public override getValidator(): TransactionValidator {
    return this.validator
  }
}
