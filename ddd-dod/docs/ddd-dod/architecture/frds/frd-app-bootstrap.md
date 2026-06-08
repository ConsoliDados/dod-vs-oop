---
slug: app-bootstrap
sdd: null
feature: app-bootstrap
epic_ref: EPIC-002 (active-foundation)
status: done
---

# FRD — app-bootstrap

> **Infra feature** (no parent SDD). The runtime **`bootstrap()`** sequence + **graceful shutdown** — the part NestJS gives for free (`NestFactory` + lifecycle hooks) that we build explicitly. Closes the never-throw loop: capture the `Err`, tear down gracefully. Modeled on **my-approfile `services/auth`** (`bootstrap.ts` + `main.ts`).

## 1. Intent

Replace the bare `process.exit(1)` in `main.ts` with a real composition root + orderly teardown:

- A **`bootstrap(env)`** function that wires everything as **error-as-value** and returns `Result<Bootstrapped, BootstrapError>` — never throws.
- **Graceful shutdown**: on `SIGTERM`/`SIGINT`, dispose resources (flush log sink, close db) **before** exiting; on a bootstrap `Err`, log a formatted reason and exit non-zero.

## 2. Inherited context (upstream refs)

- **Reference: my-approfile `services/auth`** — `bootstrap(rawEnv): Promise<Result<Bootstrapped, BootstrapError>>` returning `{ app, port, dispose }`; `main.ts` listens then registers `SIGTERM`/`SIGINT` → `dispose()` → exit. We mirror the **shape**; teardown goes through our **`container.dispose()`** (ADR-0004) instead of manual ordering, and `bootstrap` is **sync** (no async db/redis — sqlite `:memory:`).
- **ADR-0004 (amended)** — container is Result-native + disposable; this feature adds `onDispose(fn)` and wires the teardowns.
- **ADR-0002 / ADR-0005** — error-as-value; `match` at the boundary.

## 3. Acceptance criteria

- [x] `bootstrap(env): Result<Bootstrapped, BootstrapError>` — `Bootstrapped = { app, port, logger, dispose }`; never throws.
- [x] `BootstrapError` = `{ Config } | { Wiring }` (config invalid / DI resolution failed); `formatBootstrapError` renders it (delegates to `formatConfigError` / `formatDiError`).
- [x] `Container.onDispose(callback)` registers a teardown callback; `dispose()` runs all tracked teardowns (resolved `Disposable`s **and** `onDispose` callbacks) in **reverse registration order**, swallow+log, never throws.
- [x] Composition root registers teardowns: **flush + dispose** the log sink; **close** the db.
- [x] `main.ts`: `bootstrap` → `match` → `Ok` listens on `port` (logs via the structured logger) + installs `SIGTERM`/`SIGINT` handlers that log "shutting down", `await dispose()`, then `exit(0)`; `Err` logs `formatBootstrapError` + `exit(1)`. **No `throw`, no bare fail-fast.**
- [x] `/health` still works through the bootstrapped app.

## 4. API surface

```ts
bootstrap(env?: Record<string, string | undefined>): Result<Bootstrapped, BootstrapError>
type Bootstrapped = { app; port: number; logger: AppLogger; dispose: () => Promise<void> }
type BootstrapError = { Config: { error: ConfigError } } | { Wiring: { error: DiError } }
formatBootstrapError(e: BootstrapError): string
// platform/di:
Container.onDispose(callback: () => void | Promise<void>): void
```

## 5. Tasks (1–2 day units)

1. `platform/di/container.ts` — add `onDispose(fn)`; generalize the disposables list to teardown callbacks (resolved `Disposable`s register `() => instance.dispose()`).
2. `apps/api/src/composition-root.ts` — build sink/logger/db eagerly; register values; `onDispose(() => sink.flush().then(sink.dispose))` + `onDispose(() => db.close())`.
3. `apps/api/src/bootstrap.ts` — `bootstrap()` + `Bootstrapped` + `BootstrapError` + `formatBootstrapError`.
4. `apps/api/src/main.ts` — rewrite: `match(bootstrap()) → listen + graceful SIGTERM/SIGINT`.
5. Tests: container `onDispose` reverse order; `bootstrap` Ok (port, `/health`, dispose no-throw) + Err(Config) (bad `PORT`); `formatBootstrapError`.

## 6. Out of scope

- HTTP error envelope (`Err`→HTTP), request-id middleware, readiness → **FEAT-005 (http-app)**.
- Real OTLP exporter + metrics/traces → observability epic.
- Drain in-flight requests on shutdown (connection draining) — Elysia/Bun stop is enough at study scale; note if it ever matters.

## 7. Open questions

- Shutdown timeout (force-exit if `dispose` hangs) — deferred; trivial to add (`Promise.race` with a timer) if a disposer ever blocks.
