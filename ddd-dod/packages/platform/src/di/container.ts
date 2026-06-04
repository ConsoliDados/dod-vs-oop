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

/**
 * - `singleton` — one instance for the whole container tree, cached on the root
 *   and shared with every scope (default).
 * - `scoped` — one instance per `createScope()` scope (e.g. per request/task).
 * - `transient` — a fresh instance every resolve; the **caller** owns its
 *   lifecycle (the container never tracks/disposes transients).
 */
export type Lifetime = "singleton" | "scoped" | "transient";

/** Implement to be torn down on `dispose()` (graceful shutdown). */
export interface Disposable {
  dispose(): void | Promise<void>;
}

/**
 * A **Result-native, never-throwing** token-based DI container (ADR-0004,
 * amended). Functional — instance-per-`createContainer()` over closures, no
 * class, no static singleton. Hardened toward an extractable library:
 *
 * - **All-async resolve** with a "magic" `register`: a factory may return `T`
 *   **or** `Promise<T>` — `resolve` awaits it, so one path serves sync and async
 *   providers. `resolve` returns `Promise<Result<T, DiError>>`, never throws.
 * - **Single-flight**: concurrent resolves of the same singleton/scoped provider
 *   share one in-flight build; a rejected build clears the entry so a later
 *   resolve can retry.
 * - **Async-safe cycle detection** via an ancestor chain threaded into the
 *   factory's injected container (not a shared mutable set) — a cycle returns
 *   `Err(CircularDependency)` instead of deadlocking.
 * - **`peek`** — a synchronous escape hatch returning an already-built singleton
 *   (zero microtask) for the rare hot path; `Err(NotResolved)` if not built yet.
 * - **Scopes** — `createScope()` shares the root's registrations + singletons
 *   but owns its `scoped` instances and teardown list; `scope.dispose()` tears
 *   down only the scope.
 * - **Dispose** tears down tracked `Disposable`s (singletons on the root, scoped
 *   on the scope) in reverse creation order, swallowing + logging per-item
 *   failures. Transients are never tracked.
 */
export interface Container {
  register<T>(
    token: Token<T>,
    factory: (c: Container) => T | Promise<T>,
    opts?: { lifetime?: Lifetime },
  ): void;
  registerValue<T>(token: Token<T>, value: T): void;
  /** Resolve a token. Never throws — failures are `Err(DiError)`. */
  resolve<T>(token: Token<T>): Promise<Result<T, DiError>>;
  /** Synchronous read of an already-built singleton/value; `Err(NotResolved)`
   *  if registered-but-unbuilt, `Err(NotRegistered)` if absent. */
  peek<T>(token: Token<T>): Result<T, DiError>;
  has(token: Token<unknown>): boolean;
  /** Create a child scope sharing root registrations + singletons. */
  createScope(): Container;
  /** Register a teardown callback; run in reverse registration order on `dispose`. */
  onDispose(callback: () => void | Promise<void>): void;
  /** Run every teardown (tracked `Disposable`s + `onDispose` callbacks) in reverse order. */
  dispose(): Promise<void>;
}

interface Registration {
  factory: (c: Container) => unknown | Promise<unknown>;
  lifetime: Lifetime;
}

type Pending = Promise<Result<unknown, DiError>>;

interface Internal extends Container {
  readonly registrations: Map<symbol, Registration>;
  readonly singletons: Map<symbol, unknown>;
  readonly singletonInFlight: Map<symbol, Pending>;
  readonly scopedCache: Map<symbol, unknown>;
  readonly scopedInFlight: Map<symbol, Pending>;
  readonly teardowns: Array<() => void | Promise<void>>;
  root: Internal;
  resolveWith<T>(token: Token<T>, ancestors: readonly symbol[]): Promise<Result<T, DiError>>;
}

export function createContainer(): Container {
  return build(null);
}

function build(parent: Internal | null): Internal {
  // Registrations + the singleton cache live on the root and are shared down the
  // scope tree; scoped state is per-container.
  const registrations = parent ? parent.registrations : new Map<symbol, Registration>();
  const singletons = parent ? parent.singletons : new Map<symbol, unknown>();
  const singletonInFlight = parent ? parent.singletonInFlight : new Map<symbol, Pending>();
  const scopedCache = new Map<symbol, unknown>();
  const scopedInFlight = new Map<symbol, Pending>();
  const teardowns: Array<() => void | Promise<void>> = [];

  const track = (target: Internal, instance: unknown): void => {
    if (isDisposable(instance)) {
      target.teardowns.push(() => instance.dispose());
    }
  };

  // The container the factory receives: identical to `self` except `resolve`
  // threads the ancestor chain so nested resolution can detect cycles.
  const factoryView = (ancestors: readonly symbol[]): Container => ({
    register: self.register,
    registerValue: self.registerValue,
    resolve: (t) => self.resolveWith(t, ancestors),
    peek: self.peek,
    has: self.has,
    createScope: self.createScope,
    onDispose: self.onDispose,
    dispose: self.dispose,
  });

  const self: Internal = {
    registrations,
    singletons,
    singletonInFlight,
    scopedCache,
    scopedInFlight,
    teardowns,
    root: undefined as unknown as Internal, // set below

    register(t, factory, opts) {
      registrations.set(t.key, {
        factory: factory as (c: Container) => unknown,
        lifetime: opts?.lifetime ?? "singleton",
      });
    },

    registerValue(t, value) {
      // A pre-built singleton: cache + track on the root.
      self.root.singletons.set(t.key, value);
      track(self.root, value);
    },

    resolve(t) {
      return self.resolveWith(t, []);
    },

    resolveWith<T>(t: Token<T>, ancestors: readonly symbol[]): Promise<Result<T, DiError>> {
      const key = t.key;
      if (singletons.has(key)) {
        return Promise.resolve(Ok(singletons.get(key) as T) as Result<T, DiError>);
      }
      if (scopedCache.has(key)) {
        return Promise.resolve(Ok(scopedCache.get(key) as T) as Result<T, DiError>);
      }
      const registration = registrations.get(key);
      if (!registration) {
        return Promise.resolve(Err(DiError.notRegistered(t.description)));
      }
      if (ancestors.includes(key)) {
        const chain = [...ancestors, key].map((s) => s.description ?? "?");
        return Promise.resolve(Err(DiError.circularDependency(chain)));
      }

      const inFlight =
        registration.lifetime === "singleton"
          ? singletonInFlight
          : registration.lifetime === "scoped"
            ? scopedInFlight
            : null;
      const existing = inFlight?.get(key);
      if (existing) {
        return existing as Promise<Result<T, DiError>>;
      }

      const built: Promise<Result<T, DiError>> = (async () => {
        let instance: T;
        try {
          instance = (await registration.factory(factoryView([...ancestors, key]))) as T;
        } catch (cause) {
          return Err(DiError.factoryFailed(t.description, cause));
        }
        if (registration.lifetime === "singleton") {
          singletons.set(key, instance);
          track(self.root, instance);
        } else if (registration.lifetime === "scoped") {
          scopedCache.set(key, instance);
          track(self, instance);
        }
        // transient: no cache, no track — the caller owns it.
        return Ok(instance) as Result<T, DiError>;
      })().finally(() => {
        inFlight?.delete(key);
      });

      inFlight?.set(key, built as Pending);
      return built;
    },

    peek<T>(t: Token<T>): Result<T, DiError> {
      if (singletons.has(t.key)) {
        return Ok(singletons.get(t.key) as T) as Result<T, DiError>;
      }
      if (scopedCache.has(t.key)) {
        return Ok(scopedCache.get(t.key) as T) as Result<T, DiError>;
      }
      if (!registrations.has(t.key)) {
        return Err(DiError.notRegistered(t.description));
      }
      return Err(DiError.notResolved(t.description));
    },

    has(t) {
      return singletons.has(t.key) || scopedCache.has(t.key) || registrations.has(t.key);
    },

    createScope() {
      return build(self);
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
      scopedCache.clear();
      scopedInFlight.clear();
      if (parent === null) {
        // Root: also drop the shared singleton + registration state.
        singletons.clear();
        registrations.clear();
        singletonInFlight.clear();
      }
    },
  };

  self.root = parent ? parent.root : self;
  return self;
}

function isDisposable(value: unknown): value is Disposable {
  return (
    typeof value === "object" &&
    value !== null &&
    "dispose" in value &&
    typeof (value as { dispose: unknown }).dispose === "function"
  );
}
