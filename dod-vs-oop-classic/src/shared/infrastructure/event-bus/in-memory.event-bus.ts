import { Injectable } from '@nestjs/common'
import type { DomainEvent } from '../../../core/events/domain-event'
import type { EventBus, EventHandler } from '../../application/event-bus'

/**
 * In-memory synchronous EventBus — `the production reference` production style.
 *
 * **No Outbox.** `publish` fires all handlers registered for the `eventType`
 * in parallel via `Promise.all`. If any handler throws, the error propagates.
 *
 * This is the point of comparison against the DOD side, which uses a
 * transactional Outbox: here cross-bounded-context synchronization is coupled
 * to the process. If the DB transaction commits but a handler blows up, the
 * event is lost (no automatic recovery). Implements the {@link EventBus} port,
 * so the application layer never sees this concrete class.
 */
@Injectable()
export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, EventHandler[]>()

  public register<E extends DomainEvent>(eventType: string, handler: EventHandler<E>): void {
    const existing = this.handlers.get(eventType) ?? []
    existing.push(handler as EventHandler)
    this.handlers.set(eventType, existing)
  }

  public async publish<E extends DomainEvent>(event: E): Promise<void> {
    const handlers = this.handlers.get(event.eventType) ?? []
    await Promise.all(handlers.map((h) => h.handle(event)))
  }

  public async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event)
    }
  }

  public clear(): void {
    this.handlers.clear()
  }
}
