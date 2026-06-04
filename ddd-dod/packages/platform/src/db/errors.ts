import { defineError, type EnumValues } from "@ddd-dod/types";

/**
 * Database connection/probe errors (ADR-0012). Result-native like the rest of
 * platform; carries the renderers (ADR-0009). The native driver cause is
 * stringified at the boundary, never leaked raw.
 */
const variants = {
  connectionFailed: (cause: unknown) => ({ ConnectionFailed: { cause } }) as const,
  queryFailed: (cause: unknown) => ({ QueryFailed: { cause } }) as const,
} as const;

export type DbError = EnumValues<typeof variants>;

export const DbError = defineError(variants, {
  format: (e: DbError) =>
    match(e, {
      ConnectionFailed: (x) => `database connection failed: ${String(x.cause)}`,
      QueryFailed: (x) => `database query failed: ${String(x.cause)}`,
    }),
  serialize: (e: DbError) =>
    match(e, {
      ConnectionFailed: (x) => ({ kind: "ConnectionFailed", cause: String(x.cause) }),
      QueryFailed: (x) => ({ kind: "QueryFailed", cause: String(x.cause) }),
    }),
});
