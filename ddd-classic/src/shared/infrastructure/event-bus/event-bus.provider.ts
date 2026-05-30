import type { Provider } from '@nestjs/common'
import { InMemoryEventBus } from './in-memory.event-bus'

/** NestJS DI token for the {@link EventBus} port. */
export const EVENT_BUS = Symbol('EventBus')

/** Binds the `EventBus` port to its in-memory implementation (ADR-0003). */
export const eventBusProvider: Provider = {
  provide: EVENT_BUS,
  useClass: InMemoryEventBus,
}
