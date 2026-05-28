import { Injectable, Logger as NestLogger } from '@nestjs/common'
import type { Logger } from '../../application/logger'

/**
 * Console-backed `Logger` implementation — wraps NestJS's `Logger` so server
 * output stays consistent. Lives in `infrastructure/` (ADR-0005); the
 * application layer depends on the {@link Logger} port only.
 */
@Injectable()
export class ConsoleLogger implements Logger {
  private readonly nest = new NestLogger('App')

  warn(message: string, context?: Record<string, unknown>): void {
    this.nest.warn(context ? `${message} ${JSON.stringify(context)}` : message)
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.nest.error(context ? `${message} ${JSON.stringify(context)}` : message)
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.nest.log(context ? `${message} ${JSON.stringify(context)}` : message)
  }
}
