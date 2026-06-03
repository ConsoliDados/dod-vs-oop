/**
 * A minimal **token-based DI container** (ADR-0004). Used **only** at the
 * `apps/api` composition root to assemble concrete adapters, which are then
 * passed positionally into free-function use cases. It is never imported by
 * `domain/`/`application/` code — use cases stay container-agnostic.
 *
 * Resolution is singleton-by-default and lazy. Misconfiguration (missing
 * provider, circular dependency) is a programmer error surfaced as a thrown
 * `Error` at wiring time — fail-fast at startup, not domain control flow
 * (playbook §10.4). The `Result` discipline governs domain/application, not the
 * composition root's own bootstrap.
 */
export interface Token<T> {
  readonly key: symbol;
  readonly description: string;
  /** Phantom — carries `T` for inference; never present at runtime. */
  readonly __type?: T;
}

/** Mint a typed token. The description aids error messages and debugging. */
export function token<T>(description: string): Token<T> {
  return { key: Symbol(description), description };
}

export interface Container {
  /** Register a lazy factory; resolved once and memoized (singleton). */
  register<T>(token: Token<T>, factory: (c: Container) => T): void;
  /** Register an already-built value. */
  registerValue<T>(token: Token<T>, value: T): void;
  /** Resolve a token. Throws if no provider is registered (startup error). */
  resolve<T>(token: Token<T>): T;
  has(token: Token<unknown>): boolean;
}

export function createContainer(): Container {
  const factories = new Map<symbol, (c: Container) => unknown>();
  const singletons = new Map<symbol, unknown>();
  const resolving = new Set<symbol>();

  const container: Container = {
    register(t, factory) {
      factories.set(t.key, factory as (c: Container) => unknown);
    },
    registerValue(t, value) {
      singletons.set(t.key, value);
    },
    resolve<T>(t: Token<T>): T {
      if (singletons.has(t.key)) {
        return singletons.get(t.key) as T;
      }
      const factory = factories.get(t.key);
      if (!factory) {
        throw new Error(`DI: no provider registered for token "${t.description}"`);
      }
      if (resolving.has(t.key)) {
        throw new Error(`DI: circular dependency while resolving "${t.description}"`);
      }
      resolving.add(t.key);
      const value = factory(container) as T;
      resolving.delete(t.key);
      singletons.set(t.key, value);
      return value;
    },
    has(t) {
      return singletons.has(t.key) || factories.has(t.key);
    },
  };

  return container;
}
