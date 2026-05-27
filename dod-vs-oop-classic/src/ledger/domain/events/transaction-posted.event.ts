import { BaseDomainEvent } from '../../../core/events/domain-event'
import type { Currency } from '../../../shared/value-objects'

/** Per-account signed effect of a posted transaction (plain data; crosses the bus). */
export interface TransactionEntry {
  accountId: string
  amountCents: number
  currency: Currency
  /** Global monotonic posting order (ADR-0006 `throughSeq`); assigned at persistence (ADR-0008). */
  sequence: number
}

/**
 * Emitted when a transaction is posted (`TransactionAggregate.create`).
 *
 * - **Built & published by**: `PostTransactionUseCase` from the persisted postings (carries `sequence`; ADR-0008).
 * - **Consumers**: `accounts` folds `entries` into the cached available balance (FEAT-003).
 * - **Delivery**: synchronous in-memory EventBus, no Outbox (ADR-0003).
 *
 * Carries only plain data (signed cents per account) — no domain object crosses
 * the bounded-context boundary (SAD §4).
 */
export class TransactionPostedEvent extends BaseDomainEvent {
  static readonly EVENT_TYPE = 'TransactionPosted'

  constructor(
    aggregateId: string,
    public readonly postedAt: Date,
    public readonly entries: TransactionEntry[],
  ) {
    super(TransactionPostedEvent.EVENT_TYPE, aggregateId, {
      postedAt: postedAt.toISOString(),
      entries,
    })
  }
}
