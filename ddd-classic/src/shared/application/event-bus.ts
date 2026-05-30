import type { DomainEvent } from '../../core/events/domain-event'

/** Handler contract for a specific DomainEvent type. */
export interface EventHandler<E extends DomainEvent = DomainEvent> {
  handle(event: E): Promise<void>
}

/**
 * Framework-agnostic EventBus port.
 *
 * The application layer depends on this interface only — never on a concrete
 * bus or any framework. Infrastructure provides the implementation
 * (`InMemoryEventBus` today; an Outbox-backed bus is the DOD side's choice,
 * ADR-0003). Keeping this in `application/` is what lets the whole infra layer
 * (NestJS today, Elysia/Bun later) be swapped without touching use cases.
 */
export interface EventBus {
  register<E extends DomainEvent>(eventType: string, handler: EventHandler<E>): void
  publish<E extends DomainEvent>(event: E): Promise<void>
  publishAll(events: DomainEvent[]): Promise<void>
}
