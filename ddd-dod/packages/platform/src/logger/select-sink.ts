import { createConsoleSink } from "./console-sink";
import type { LogSink } from "./log-sink";
import { createOtlpLogSink, type OtelLogEmitter } from "./otlp-log-sink";

export interface SelectSinkOptions {
  /** Drives the transport choice (from `AppConfig.NODE_ENV`). */
  nodeEnv: "development" | "test" | "production";
  /** When present in `production`, logs go to OTLP instead of the console.
   *  Injected by the observability epic (ADR-0007); absent here, prod falls
   *  back to console JSON. */
  otelEmitter?: OtelLogEmitter;
}

/**
 * Pick the log transport by environment (FRD-002):
 * - `development` → console **pretty** (human, colorized)
 * - `test` / `production` (no emitter) → console **json** (one line per record)
 * - `production` **with** an `otelEmitter` → {@link createOtlpLogSink} (→ observability stack)
 *
 * The `LogSink` strategy is unchanged; this only chooses which concrete sink the
 * composition root wires into `createLogger`.
 */
export function selectSink(opts: SelectSinkOptions): LogSink {
  if (opts.nodeEnv === "production" && opts.otelEmitter) {
    return createOtlpLogSink(opts.otelEmitter);
  }
  return createConsoleSink({ format: opts.nodeEnv === "development" ? "pretty" : "json" });
}
