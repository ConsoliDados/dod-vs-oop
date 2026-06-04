import { DiError } from "./errors";

/**
 * A typed DI token. The phantom `__type` carries `T` for inference; the runtime
 * identity is the unique `Symbol`. Never set at runtime.
 */
export interface Token<T> {
  readonly key: symbol;
  readonly description: string;
  readonly __type?: T;
}

/** Mint a typed token. The description aids error messages and debugging. */
export function token<T>(description: string): Token<T> {
  return { key: Symbol(description), description };
}

export type Lifetime = "singleton" | "transient";

/** Implement to be torn down on `Container.dispose()` (graceful shutdown). */
export interface Disposable {
  dispose(): void | Promise<void>;
}

/**
 * A **Result-native, never-throwing** token-based DI container (ADR-0004,
 * amended). Used only at the `apps/api` composition root; use cases stay
 * container-agnostic. Functional — instance-per-`createContainer()` over
 * closures, **no class, no static singleton** (the thing that aged badly in the
 * `conecta` reference).
 *
 * - `resolve` returns `Result<T, DiError>` — never throws. The bootstrap matches
 *   the `Err` and shuts down gracefully (FEAT-004) instead of crashing.
 * - Lifetimes: `singleton` (default, memoized lazily) and `transient`.
 * - `dispose` tears down tracked `Disposable` singletons in reverse creation
 *   order, swallowing + logging per-item failures.
 */
export interface Container {
  register<T>(token: Token<T>, factory: (c: Container) => T, opts?: { lifetime?: Lifetime }): void;
  registerValue<T>(token: Token<T>, value: T): void;
  /** Resolve a token. Never throws — failures are `Err(DiError)`. */
  resolve<T>(token: Token<T>): Result<T, DiError>;
  has(token: Token<unknown>): boolean;
  /** Register a teardown callback; run in reverse registration order on `dispose`. */
  onDispose(callback: () => void | Promise<void>): void;
  /** Run every teardown (resolved `Disposable`s + `onDispose` callbacks) in reverse order. */
  dispose(): Promise<void>;
}

interface Registration {
  factory: (c: Container) => unknown;
  lifetime: Lifetime;
}

export function createContainer(): Container {
  const registrations = new Map<symbol, Registration>();
  const singletons = new Map<symbol, unknown>();
  const resolving = new Set<symbol>();
  const resolvingStack: string[] = [];
  // Teardown callbacks in registration order; run in reverse on dispose().
  const teardowns: Array<() => void | Promise<void>> = [];

  const trackDisposable = (instance: unknown): void => {
    if (isDisposable(instance)) {
      teardowns.push(() => instance.dispose());
    }
  };

  const container: Container = {
    register(t, factory, opts) {
      registrations.set(t.key, {
        factory: factory as (c: Container) => unknown,
        lifetime: opts?.lifetime ?? "singleton",
      });
    },

    registerValue(t, value) {
      singletons.set(t.key, value);
      trackDisposable(value);
    },

    resolve<T>(t: Token<T>): Result<T, DiError> {
      if (singletons.has(t.key)) {
        return Ok(singletons.get(t.key) as T) as Result<T, DiError>;
      }
      const registration = registrations.get(t.key);
      if (!registration) {
        return Err(DiError.notRegistered(t.description)) as Result<T, DiError>;
      }
      if (resolving.has(t.key)) {
        return Err(DiError.circularDependency([...resolvingStack, t.description])) as Result<
          T,
          DiError
        >;
      }

      resolving.add(t.key);
      resolvingStack.push(t.description);
      let instance: T;
      try {
        instance = registration.factory(container) as T;
      } catch (cause) {
        return Err(DiError.factoryFailed(t.description, cause)) as Result<T, DiError>;
      } finally {
        resolving.delete(t.key);
        resolvingStack.pop();
      }

      if (registration.lifetime === "singleton") {
        singletons.set(t.key, instance);
      }
      trackDisposable(instance);
      return Ok(instance) as Result<T, DiError>;
    },

    has(t) {
      return singletons.has(t.key) || registrations.has(t.key);
    },

    onDispose(callback) {
      teardowns.push(callback);
    },

    async dispose() {
      // Reverse registration order; a failing teardown is swallowed + logged so
      // the rest still run (never throws).
      for (const teardown of [...teardowns].reverse()) {
        try {
          await teardown();
        } catch (err) {
          console.error("[di] teardown failed", err);
        }
      }
      teardowns.length = 0;
      singletons.clear();
      registrations.clear();
    },
  };

  return container;
}

function isDisposable(value: unknown): value is Disposable {
  return (
    typeof value === "object" &&
    value !== null &&
    "dispose" in value &&
    typeof (value as { dispose: unknown }).dispose === "function"
  );
}
