import type { LogRecord } from "./log-record";

/**
 * Transport port — the single seam between the logger and wherever logs go.
 * `createConsoleSink` ships in this package; an aggregator sink (OpenTelemetry /
 * Datadog / …) implements the same contract without touching the logger.
 *
 * # Invariants
 * - `emit` MUST NOT throw. A transport failure is the sink's problem to
 *   swallow — losing a log line must never break the request that produced it.
 * - `emit` is fire-and-forget and cheap; batching/IO belongs behind it.
 */
export interface LogSink {
  /** Hand a finished record to the transport. Never throws. */
  emit(record: LogRecord): void;
  /** Drain any buffered records (e.g. before shutdown). */
  flush(): Promise<void>;
  /** Release resources (timers, sockets). Idempotent. */
  dispose(): Promise<void>;
}
