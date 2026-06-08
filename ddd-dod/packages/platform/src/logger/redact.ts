import type { LogFields, LogValue } from "./log-record";

/**
 * Field keys whose values are masked before a record leaves the logger.
 * Matched case-insensitively. Secret hygiene: a stray
 * `logger.info("signin", { password })` must never reach a sink in the clear.
 * Callers extend this set via `LoggerConfig.redactKeys`; they cannot shrink it.
 */
export const DEFAULT_REDACT_KEYS: readonly string[] = [
  "password",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "cookie",
  "set-cookie",
  "secret",
  "clientsecret",
  "apikey",
];

const REDACTED = "[REDACTED]";

/** Lower-cased lookup set built once from the default + caller keys. */
export function buildRedactSet(extra: readonly string[] = []): ReadonlySet<string> {
  return new Set([...DEFAULT_REDACT_KEYS, ...extra].map((k) => k.toLowerCase()));
}

/**
 * Return a copy of `fields` with any sensitive key's value replaced by
 * `[REDACTED]`, recursing into nested objects/arrays. Pure — never mutates the
 * input. Only keys are matched (not value contents).
 */
export function redactFields(fields: LogFields, keys: ReadonlySet<string>): LogFields {
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = keys.has(key.toLowerCase()) ? REDACTED : redactValue(value, keys);
  }
  return out;
}

function redactValue(value: LogValue, keys: ReadonlySet<string>): LogValue {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, keys));
  }
  if (value !== null && typeof value === "object") {
    return redactFields(value, keys);
  }
  return value;
}
