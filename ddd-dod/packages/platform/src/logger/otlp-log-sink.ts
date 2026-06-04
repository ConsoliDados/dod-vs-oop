import type { LogLevel, LogRecord } from "./log-record";
import type { LogSink } from "./log-sink";

/**
 * The subset of the OpenTelemetry **logs data model** we emit. The observability
 * epic's {@link OtelLogEmitter} forwards this to the OTel SDK / OTLP exporter →
 * Collector → Loki (ADR-0007). Kept as a plain value so this package needs no
 * OTel dependency.
 */
export interface OtelLogData {
  /** Emit time in Unix nanoseconds (OTel `timeUnixNano`). */
  readonly timeUnixNano: number;
  /** OTel severity number (debug 5 · info 9 · warn 13 · error 17). */
  readonly severityNumber: number;
  /** OTel severity text (`DEBUG` … `ERROR`). */
  readonly severityText: string;
  /** The log message (OTel `body`). */
  readonly body: string;
  /** Structured attributes (context, fields, requestId, flattened error). */
  readonly attributes: Record<string, unknown>;
}

/**
 * Transport seam. The observability epic implements this with
 * `@opentelemetry/sdk-logs` + an OTLP HTTP exporter (→ OTel Collector). Tests
 * pass a capturing fake. `emit` must not throw.
 */
export interface OtelLogEmitter {
  emit(record: OtelLogData): void;
}

const SEVERITY: Record<LogLevel, { number: number; text: string }> = {
  debug: { number: 5, text: "DEBUG" },
  info: { number: 9, text: "INFO" },
  warn: { number: 13, text: "WARN" },
  error: { number: 17, text: "ERROR" },
};

/**
 * A {@link LogSink} that maps our {@link LogRecord} to the OTel logs data model
 * and hands it to an injected {@link OtelLogEmitter}. Like every sink, `emit`
 * never throws — a transport failure must not break the request that logged.
 */
export function createOtlpLogSink(emitter: OtelLogEmitter): LogSink {
  return {
    emit(record: LogRecord): void {
      try {
        const severity = SEVERITY[record.level];
        const attributes: Record<string, unknown> = { context: record.context };
        if (record.requestId !== undefined) {
          attributes.requestId = record.requestId;
        }
        if (record.fields) {
          Object.assign(attributes, record.fields);
        }
        if (record.err) {
          attributes["error.name"] = record.err.name;
          attributes["error.message"] = record.err.message;
          if (record.err.stack) {
            attributes["error.stack"] = record.err.stack;
          }
        }
        emitter.emit({
          timeUnixNano: Date.parse(record.time) * 1_000_000,
          severityNumber: severity.number,
          severityText: severity.text,
          body: record.message,
          attributes,
        });
      } catch (err) {
        console.error("[logger] OTLP sink emit failed", err);
      }
    },
    flush: () => Promise.resolve(),
    dispose: () => Promise.resolve(),
  };
}
