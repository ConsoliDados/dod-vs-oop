import { defineError, type EnumValues } from "@ddd-dod/types";

/**
 * DI container errors — a Rust-enum-style union (ADR-0002, ADR-0004 amended)
 * built with {@link defineError} (ADR-0008). The container is **Result-native**:
 * resolution failures are values returned from `resolve`, never thrown. The
 * composition root / bootstrap captures them and shuts down gracefully (FEAT-004).
 *
 * The error carries its own renderers (ADR-0009): `DiError.format` (Display, for
 * the boot log) and `DiError.serialize` (structured, for observability).
 */
const variants = {
  notRegistered: (token: string) => ({ NotRegistered: { token } }) as const,
  notResolved: (token: string) => ({ NotResolved: { token } }) as const,
  circularDependency: (chain: readonly string[]) => ({ CircularDependency: { chain } }) as const,
  factoryFailed: (token: string, cause: unknown) => ({ FactoryFailed: { token, cause } }) as const,
} as const;

export type DiError = EnumValues<typeof variants>;

export const DiError = defineError(variants, {
  format: (e: DiError) =>
    match(e, {
      NotRegistered: (x) => `no provider registered for token "${x.token}"`,
      NotResolved: (x) =>
        `token "${x.token}" is registered but not built yet — call resolve() first (peek() is for already-resolved singletons)`,
      CircularDependency: (x) => `circular dependency: ${x.chain.join(" -> ")}`,
      FactoryFailed: (x) => `factory for token "${x.token}" failed: ${String(x.cause)}`,
    }),
  serialize: (e: DiError) =>
    match(e, {
      NotRegistered: (x) => ({ kind: "NotRegistered", token: x.token }),
      NotResolved: (x) => ({ kind: "NotResolved", token: x.token }),
      CircularDependency: (x) => ({ kind: "CircularDependency", chain: x.chain }),
      FactoryFailed: (x) => ({ kind: "FactoryFailed", token: x.token, cause: String(x.cause) }),
    }),
});
