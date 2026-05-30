/**
 * Framework-agnostic logger port (ADR-0005).
 *
 * Used by application-layer code that needs to emit operational telemetry
 * without coupling to NestJS. The synchronous in-memory EventBus has no Outbox
 * (ADR-0003), so a cross-context handler that swallows a recomputable-cache
 * failure must surface it through this port — never through a thrown error to
 * the producer. Impl lives in `shared/infrastructure/logger/`; tests override
 * the provider with a spy.
 */
export interface Logger {
  warn(message: string, context?: Record<string, unknown>): void
  error(message: string, context?: Record<string, unknown>): void
  info(message: string, context?: Record<string, unknown>): void
}
