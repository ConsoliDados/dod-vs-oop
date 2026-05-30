import type { Provider } from '@nestjs/common'
import { ConsoleLogger } from './console.logger'

/** NestJS DI token for the {@link Logger} port. */
export const LOGGER = Symbol('Logger')

/** Binds the `Logger` port to a console-backed implementation. */
export const loggerProvider: Provider = {
  provide: LOGGER,
  useClass: ConsoleLogger,
}
