import {
  LOG_LEVEL_RANK,
  type LogFields,
  type LogLevel,
  type LogRecord,
  type SerializedError,
} from "./log-record";
import type { LogSink } from "./log-sink";
import { buildRedactSet, redactFields } from "./redact";

/**
 * The logging surface application code holds. Level-filtered, structured, and
 * correlated: every call becomes a `LogRecord` handed to the bound
 * {@link LogSink}. Obtained from {@link createLogger} and narrowed per request
 * via {@link AppLogger.child}.
 *
 * # Invariants
 * - No method throws — a logging failure never surfaces to the caller.
 * - `error` takes the thrown value as the second arg; it is normalized to
 *   `SerializedError` before emission.
 */
export interface AppLogger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, err?: unknown, fields?: LogFields): void;
  /** Derive a logger inheriting transport + level, merging `bindings` into
   *  every record it emits — the per-request correlation seam. */
  child(bindings: LogBindings): AppLogger;
}

/** Context/correlation overlay merged into a child logger's records. */
export interface LogBindings {
  context?: string;
  requestId?: string;
  fields?: LogFields;
}

export interface LoggerConfig {
  /** Minimum level emitted; lower-ranked records are dropped. */
  level: LogLevel;
  /** Where records go. Inject a console sink (or a future aggregator sink). */
  sink: LogSink;
  /** Root context (module/service name). Defaults to `"app"`. */
  context?: string;
  /** Extra sensitive keys to redact on top of the non-negotiable defaults. */
  redactKeys?: readonly string[];
}

interface LoggerState {
  threshold: number;
  sink: LogSink;
  redactKeys: ReadonlySet<string>;
  context: string;
  requestId: string | undefined;
  baseFields: LogFields | undefined;
}

/**
 * Build the process-wide base logger. Functional and immutable: there is no
 * class — `child` closes over a fresh state object rather than mutating shared
 * state, so request loggers can't leak correlation into each other.
 */
export function createLogger(config: LoggerConfig): AppLogger {
  return bind({
    threshold: LOG_LEVEL_RANK[config.level],
    sink: config.sink,
    redactKeys: buildRedactSet(config.redactKeys),
    context: config.context ?? "app",
    requestId: undefined,
    baseFields: undefined,
  });
}

function bind(state: LoggerState): AppLogger {
  const write = (level: LogLevel, message: string, err: unknown, fields?: LogFields): void => {
    if (LOG_LEVEL_RANK[level] < state.threshold) {
      return;
    }
    const merged = mergeFields(state.baseFields, fields);
    const record: LogRecord = {
      time: new Date().toISOString(),
      level,
      context: state.context,
      message,
    };
    if (state.requestId !== undefined) {
      record.requestId = state.requestId;
    }
    if (merged) {
      record.fields = redactFields(merged, state.redactKeys);
    }
    if (err !== undefined) {
      record.err = serializeError(err);
    }
    // The sink contract forbids throwing, but a logging failure must never
    // bubble into the caller — guard defensively as a last resort.
    try {
      state.sink.emit(record);
    } catch (sinkErr) {
      console.error("[logger] sink.emit threw", sinkErr);
    }
  };

  return {
    debug: (message, fields) => write("debug", message, undefined, fields),
    info: (message, fields) => write("info", message, undefined, fields),
    warn: (message, fields) => write("warn", message, undefined, fields),
    error: (message, err, fields) => write("error", message, err, fields),
    child: (bindings) =>
      bind({
        ...state,
        context: bindings.context ?? state.context,
        requestId: bindings.requestId ?? state.requestId,
        baseFields: mergeFields(state.baseFields, bindings.fields),
      }),
  };
}

function mergeFields(a?: LogFields, b?: LogFields): LogFields | undefined {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  return { ...a, ...b };
}

const MAX_CAUSE_DEPTH = 5;

function serializeError(err: unknown, depth = 0): SerializedError {
  if (err instanceof Error) {
    const out: SerializedError = { name: err.name, message: err.message };
    if (err.stack) {
      out.stack = err.stack;
    }
    if (err.cause !== undefined && depth < MAX_CAUSE_DEPTH) {
      out.cause = serializeError(err.cause, depth + 1);
    }
    return out;
  }
  return { name: "NonError", message: typeof err === "string" ? err : safeStringify(err) };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
