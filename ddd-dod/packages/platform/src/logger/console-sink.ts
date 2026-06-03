import type { LogLevel, LogRecord } from "./log-record";
import type { LogSink } from "./log-sink";

export type LogFormat = "pretty" | "json";

export interface ConsoleSinkOptions {
  /** `json` (one line per record) or `pretty` (colorized, dev). Defaults by `NODE_ENV`. */
  format?: LogFormat;
  /** ANSI colors in `pretty` mode. Defaults to `true`. */
  colors?: boolean;
}

/**
 * The default {@link LogSink}: writes to the process console. Functional (a
 * factory + closure, no class). `json` emits one `JSON.stringify(record)` line
 * (the production shape an aggregator scrapes from stdout); `pretty` emits a
 * colorized human line for local dev. `emit` never throws.
 */
export function createConsoleSink(options: ConsoleSinkOptions = {}): LogSink {
  const format: LogFormat =
    options.format ?? (process.env.NODE_ENV === "production" ? "json" : "pretty");
  const colors = options.colors ?? true;

  return {
    emit(record: LogRecord): void {
      try {
        const line = format === "json" ? JSON.stringify(record) : pretty(record, colors);
        write(record.level, line);
      } catch (err) {
        console.error("[logger] console sink emit failed", err);
      }
    },
    flush(): Promise<void> {
      return Promise.resolve();
    },
    dispose(): Promise<void> {
      return Promise.resolve();
    },
  };
}

function pretty(record: LogRecord, colors: boolean): string {
  const paint = (text: string, color: string): string =>
    colors ? `${color}${text}${RESET}` : text;
  const parts = [
    paint(record.time, DIM),
    paint(`[${record.level.toUpperCase()}]`, LEVEL_COLOR[record.level]),
    paint(`[${record.context}]`, CYAN),
  ];
  if (record.requestId) {
    parts.push(paint(`(${record.requestId})`, DIM));
  }
  parts.push(record.message);
  if (record.fields && Object.keys(record.fields).length > 0) {
    parts.push(JSON.stringify(record.fields));
  }
  if (record.err) {
    parts.push(record.err.stack ?? `${record.err.name}: ${record.err.message}`);
  }
  return parts.join(" ");
}

function write(level: LogLevel, line: string): void {
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const LEVEL_COLOR: Record<LogLevel, string> = {
  debug: "\x1b[34m",
  info: "\x1b[32m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
};
