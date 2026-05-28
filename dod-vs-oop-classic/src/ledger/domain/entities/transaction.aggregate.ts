import { AggregateRoot } from '../../../core/entities/aggregate-root'
import type { InvalidEntityError } from '../../../core/errors'
import { type Currency, Identifier, Money } from '../../../shared/value-objects'
import type { TransactionEntry } from '../events/transaction-posted.event'
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
 * (SRS glossary; REQ-006). The unit of consistency for a money movement.
 *
 * **Deliberately behavior-light — this is NOT an anemic-domain smell.** A ledger
 * is append-only and immutable (REQ-011; double-entry has worked this way since
 * Pacioli, 1494): once posted, a transaction and its postings are never mutated.
 * The aggregate therefore exposes only factories + getters by design — there is no
 * legitimate `update()` / state transition to model, so modelling one would be the
 * mistake, not the absence. Corrections happen by **reversal** (FEAT-004, REQ-007):
 * a *new* mirror transaction, never a mutation of the original.
 *
 * Contrast the account aggregate, whose mutable cached balance and (future)
 * status legitimately carry behavior (e.g. `reflectPosting`, `freeze`/`close`) —
 * there, getters-only *would* be anemia. The distinction is the domain rule, not a
 * coding shortcut. See `docs/.../architecture/sdds/sdd-ledger.md` §4 (invariant 6),
 * SRS REQ-011, and ADR-0006.
 *
 * Invariants (enforced by {@link TransactionValidator}, throw-based per ADR-0002):
 * - ≥2 postings; all sharing a single currency; signed amounts sum to zero.
 *
 * The `TransactionPosted` event is built & published by `PostTransactionUseCase`
 * from the persisted postings (it needs each posting's `sequence`; ADR-0008), not
 * emitted here. Cross-context checks (account existence + currency match) are the
 * use case's job, not the aggregate's.
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
    // `TransactionPosted` is built & published by the use case from the persisted
    // postings (it needs each posting's `sequence`, assigned at persistence; ADR-0008).
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

  /**
   * Plain-data per-account effects for the `TransactionPosted` payload — including
   * each posting's `sequence` (ADR-0008). Call **after persistence**: the sequence is
   * assigned at insert, so an unpersisted posting throws here.
   */
  public toEntries(): TransactionEntry[] {
    return this.postings.map((p) => {
      const sequence = p.getSequence()
      if (sequence === undefined) {
        throw new Error('toEntries() requires persisted postings (sequence not yet assigned)')
      }
      return {
        accountId: p.getAccountId().getValue(),
        amountCents: p.getSignedCents(),
        currency: p.getAmount().getCurrency(),
        sequence,
      }
    })
  }

  public override toString(): string {
    return `TransactionAggregate(${this.getId().getValue()})`
  }

  public override getValidator(): TransactionValidator {
    return this.validator
  }
}
