import { Global, Module } from '@nestjs/common'
import { EVENT_BUS, eventBusProvider } from './infrastructure/event-bus/event-bus.provider'
import { LOGGER, loggerProvider } from './infrastructure/logger/logger.provider'

/**
 * Cross-context shared providers. Global so every bounded context shares a
 * single synchronous in-memory EventBus instance (ADR-0003) and a single
 * `Logger` port without re-importing. Exposes the `EventBus` and `Logger` ports
 * via their token Symbols only.
 */
@Global()
@Module({
  providers: [eventBusProvider, loggerProvider],
  exports: [EVENT_BUS, LOGGER],
})
export class SharedModule {}
