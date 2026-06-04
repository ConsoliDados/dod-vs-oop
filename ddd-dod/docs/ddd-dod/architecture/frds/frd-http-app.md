---
id: FRD-006
slug: http-app
sdd: null
feature: http-app
epic_ref: EPIC-002 (active-foundation)
status: done
---

# FRD-006 — http-app

> **Infra feature** (no parent SDD). The Elysia HTTP app: a consistent **error envelope**, **request-id + request-scoped logger** middleware, and **health/readiness** endpoints — the part a batteries-included framework hides, built explicitly. Composed with the **named-controller pattern** validated against **my-approfile `services/auth`** (ADR-0014 inbound layer): one `new Elysia({ name })` per controller, mounted via `.use()`, **no `app` passed into a controller**.

## 1. Intent

Turn the placeholder `/health`-only app into the real HTTP boundary:

- **Named-controller composition** — a single-source `setup` plugin carries the resolved deps + per-request correlation; controllers `.use(setup)` to get them **typed**; a global error boundary renders the envelope. No controller receives the `app` (so controller hooks stay encapsulated — the implicit win over factory-receives-app).
- **Error envelope** (SRS NFR-OBS-001) — every error returns a stable JSON shape + correct status; 5xx are logged with the request id and the cause never leaks.
- **Request correlation** — a fresh `requestId` per request, emitted as `x-request-id` and bound into a child logger.
- **Readiness** — `/ready` runs the DB probe so an orchestrator can gate traffic.

## 2. Inherited context (upstream refs)

- **ADR-0014** — inbound adapters (HTTP routes) live in `apps/api/src/http`; the named-controller pattern (setup = single source, no `app` passed) was proven in a typed spike (decorators, request-scoped derive, and plugin/macro `hasAuth` gating all verified).
- **Reference: my-approfile `services/auth`** — the Elysia composition idiom; we keep its single-source-of-truth but use **standalone named controllers** (`.use(setup)`) instead of factory-receives-app, for per-controller encapsulation.
- **ADR-0009** — `format` (Display) vs `serialize` renderers; the envelope is the route-boundary mapping deferred there.
- **ADR-0012** — `DbHandle.probe()` (`SELECT 1`, never throws) backs `/ready`.

## 3. Acceptance criteria

- [x] `createApp(deps: { config, logger, db })` builds the app via named controllers; **no `app` is passed into any controller**; `setup` (`name: "setup"`) is the single source of `config`/`db` decorators + the `as: "scoped"` derive (`requestId`, child `log`, `x-request-id` header).
- [x] `GET /health` → **200** liveness `{ status: "ok", service: "ddd-dod", env }`.
- [x] `GET /ready` → DB probe: **200** `{ status: "ready", checks: { db: "ok" } }` on `Ok`; **503** `{ status: "unready", checks: { db: "down" } }` on `Err` (logged via the scoped logger).
- [x] Request-id middleware: a handled response carries an `x-request-id` header; the child logger is bound to that id.
- [x] Error envelope (global `onError`, `as: "global"`): `NOT_FOUND`→**404**, `VALIDATION`→**422**, `PARSE`→**400**, anything else→**500**. Shape `{ error: { code, message }, requestId? }`; 5xx logged with `requestId`, cause not leaked to the client.
- [x] `bootstrap` threads `logger` + `db` (read back via `container.peek`) into `createApp`; `main.ts` unchanged path still listens + graceful-shuts-down.
- [x] `bun run check` clean; `bun test` green (E2E via `app.handle`, deps injected).

## 4. API surface

```ts
// apps/api/src/http/
createSetup(deps: HttpDeps)            // named "setup" plugin: decorate config+db, derive requestId+log+header
type HttpDeps = { config: AppConfig; logger: AppLogger; db: DbHandle }
errorEnvelope(log: AppLogger)          // named "error-envelope" plugin: global onError → ErrorEnvelope
type ErrorEnvelope = { error: { code: string; message: string }; requestId?: string }
createHealthController(setup: Setup)   // standalone: GET /health, GET /ready
// apps/api/src/
createApp(deps: HttpDeps)              // new Elysia().use(errorEnvelope(log)).use(healthController(setup))
```

## 5. Tasks

1. `apps/api/src/http/setup.ts` — `createSetup` named plugin (decorate config/db; scoped derive requestId + child log + `x-request-id` header).
2. `apps/api/src/http/error-envelope.ts` — `errorEnvelope` plugin (global onError, code→status map, stable envelope, 5xx logging).
3. `apps/api/src/http/health.controller.ts` — `/health` (liveness) + `/ready` (DB probe → 200/503).
4. `apps/api/src/app.ts` — refactor `createApp(deps)` to the named-controller composition.
5. `apps/api/src/bootstrap.ts` — peek `Tokens.Db`; pass `{ config, logger, db }` to `createApp`.
6. Tests: `apps/api/tests/http.e2e.test.ts` — health, readiness 200/503, x-request-id, 404 envelope (injected deps).

## 6. Out of scope

- Domain context routes (ledger/accounts/statements/reconciliation controllers) → **EPIC-003** (mount the same way, `.use(setup)`).
- Auth/`hasAuth` macro — out of study scope (SRS §2.2); the pattern supports it (proven in the spike), but no auth routes here.
- `@elysiajs/openapi`, `cors` — trivial root `.use()` when needed; not part of the boundary contract.
- Connection draining on shutdown — Elysia/Bun stop is enough at study scale (FRD-004 §6).

## 7. Open questions

- **`requestId` on an unmatched-route 404** — the `x-request-id` derive is scoped to controllers, so a pure 404 (no route matched) has no request id and the envelope omits it (best-effort). Acceptable; a root-level `onRequest` could generate it unconditionally if correlation on 404s ever matters.
- Bun/Elysia route matching is **host-tolerant but not host-free** — a single-letter host (`http://x/...`) failed routing in testing; tests use `http://localhost/...`. Noted so future E2E tests use a real host.
