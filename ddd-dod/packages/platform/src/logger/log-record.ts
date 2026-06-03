/**
 * The wire shape every {@link LogSink} receives — one record per log call,
 * enriched with the emitting logger's `context` and any per-request
 * `requestId`. JSON-serializable end to end (see {@link LogValue}).
 */
export interface LogRecord {
  time: string;
  level: LogLevel;
  context: string;
  message: string;
  requestId?: string;
  fields?: LogFields;
  err?: SerializedError;
}

/** Severity, low → high. Filtering compares {@link LOG_LEVEL_RANK}. */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Numeric severity used for level filtering — distinct values (not a 0..n
 * index) so inserting a level later doesn't renumber the others.
 */
export const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** JSON-serializable value — keeps structured fields off untyped `any`. */
export type LogValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | LogValue[]
  | { [key: string]: LogValue };

/** Structured key/value metadata attached to a log record. */
export type LogFields = Record<string, LogValue>;

/** Normalized error shape (name + message + stack, recursive `cause`). */
export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  cause?: SerializedError;
}
