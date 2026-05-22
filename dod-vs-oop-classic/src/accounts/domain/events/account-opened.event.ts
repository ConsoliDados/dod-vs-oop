import { BaseDomainEvent } from '../../../core/events/domain-event'
import type { Currency } from '../../../shared/value-objects'

/**
 * Emitted when an account is opened (`AccountAggregate.create`).
 *
 * - **Emitted by**: `AccountAggregate.create`
 * - **Consumers**: none yet (establishes the cross-context event pattern;
 *   balance-affecting events arrive with the `ledger` context in FEAT-002+).
 * - **Delivery**: synchronous in-memory EventBus, no Outbox (ADR-0003).
 */
export class AccountOpenedEvent extends BaseDomainEvent {
  static readonly EVENT_TYPE = 'AccountOpened'

  constructor(
    aggregateId: string,
    public readonly ownerId: string,
    public readonly currency: Currency,
  ) {
    super(AccountOpenedEvent.EVENT_TYPE, aggregateId, { ownerId, currency })
  }
}
