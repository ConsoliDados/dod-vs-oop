/**
 * DI container errors — a Rust-enum-style union (ADR-0002, ADR-0004 amended).
 * The container is **Result-native**: resolution failures are values returned
 * from `resolve`, never thrown. The composition root / bootstrap captures them
 * and shuts down gracefully (FEAT-004).
 */
export type DiError =
  | { NotRegistered: { token: string } }
  | { CircularDependency: { chain: readonly string[] } }
  | { FactoryFailed: { token: string; cause: unknown } };

export const DiError = {
  notRegistered: (token: string): DiError => ({ NotRegistered: { token } }),
  circularDependency: (chain: readonly string[]): DiError => ({ CircularDependency: { chain } }),
  factoryFailed: (token: string, cause: unknown): DiError => ({ FactoryFailed: { token, cause } }),
};

export const formatDiError = (error: DiError): string =>
  match(error, {
    NotRegistered: (x) => `no provider registered for token "${x.token}"`,
    CircularDependency: (x) => `circular dependency: ${x.chain.join(" -> ")}`,
    FactoryFailed: (x) => `factory for token "${x.token}" failed: ${String(x.cause)}`,
  });
