import { Global, Module } from '@nestjs/common'
import { EVENT_BUS, eventBusProvider } from './infrastructure/event-bus/event-bus.provider'

/**
 * Cross-context shared providers. Global so every bounded context shares a
 * single synchronous in-memory EventBus instance (ADR-0003) without re-importing.
 * Exposes the `EventBus` port via the `EVENT_BUS` token only.
 */
@Global()
@Module({
  providers: [eventBusProvider],
  exports: [EVENT_BUS],
})
export class SharedModule {}
