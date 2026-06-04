---
id: FRD-001
slug: config
sdd: null
feature: config
epic_ref: EPIC-002 (active-foundation)
status: done
---

# FRD-001 — config

> **Infra feature** (no parent SDD — EPIC-002 references none). The "what" of process configuration for the runtime foundation.

## 1. Intent

Load and **validate** process configuration from the environment, expose it as a typed, immutable `AppConfig`, and surface failure as a `Result` (never throw) with a **human-readable** error the composition root can log before exiting. This is FEAT-001 because everything downstream (logger level, server port, lifecycle) reads from it.

## 2. Inherited context (upstream refs, not a domain SDD)

- **SAD §5** — config is a cross-cutting concern parsed at process start.
- **ADR-0006** — Zod guards external untrusted boundaries; the environment is one. Env uses a **non-strict** object (unknown keys stripped, not rejected — `process.env` carries hundreds of unrelated keys).
- **ADR-0001 / port convention** — `PORT` defaults to **3333**; never `3000` (reserved for a frontend).
- **ADR-0005** — failure is an `Err`, not a throw.

## 3. Acceptance criteria

- [x] `loadConfig()` with a valid (or empty) env returns `Ok(AppConfig)` with defaults applied.
- [x] Unknown env keys are **ignored** (stripped), not rejected.
- [x] `PORT` defaults to `3333`, is coerced from string, and is rejected when non-integer or outside `1..65535`.
- [x] `LOG_LEVEL` defaults to `info`; accepts only `debug|info|warn|error`.
- [x] `NODE_ENV` defaults to `development`; accepts only `development|test|production`.
- [x] Invalid input returns `Err(ConfigError)` carrying the Zod issues — **never throws**.
- [x] `formatConfigError(err)` returns a readable multi-line string (one line per issue: `PATH: message`).
- [x] `AppConfig` is immutable at runtime (`Object.freeze`) as well as in the type.
- [x] `apps/api/src/main.ts` logs `formatConfigError(...)` (not raw issues) on a config failure.

## 4. Validation rules

| Field | Rule | Default |
|-------|------|---------|
| `NODE_ENV` | enum `development \| test \| production` | `development` |
| `PORT` | `coerce.number().int().positive().max(65535)` | `3333` |
| `LOG_LEVEL` | enum `debug \| info \| warn \| error` | `info` |

- Schema is a plain (non-`.strict()`) object so unknown env keys are dropped.
- `loadConfig(env = process.env)` — `env` is injectable so tests pass explicit maps.

## 5. Tasks (1–2 day units, bottom-up)

1. Harden the Zod schema + derive the immutable `AppConfig` type; `Object.freeze` the parsed result.
2. Add `formatConfigError(e: ConfigError): string` (one line per Zod issue).
3. Export `loadConfig`, `formatConfigError`, `AppConfig`, `ConfigError` from the package public API.
4. Wire `apps/api/src/main.ts` to log `formatConfigError(error)` on the `Err` branch.
5. Tests: happy path, all-defaults (empty env), invalid `PORT` (non-numeric + out of range), invalid `LOG_LEVEL`, unknown-key stripping, `formatConfigError` output.

## 6. Behavioral API surface

```ts
loadConfig(env?: Record<string, string | undefined>): Result<AppConfig, ConfigError>
formatConfigError(error: ConfigError): string
type AppConfig    // { readonly NODE_ENV; readonly PORT; readonly LOG_LEVEL }
type ConfigError  // { type: "InvalidConfig"; issues: ZodError["issues"] }
```

## 7. Out of scope

- Secrets management / vaults; `.env` file precedence (Bun auto-loads `.env`; not orchestrated here).
- `HOST`/hostname + TLS binding — deferred to FEAT-005 (http-app) where listen options live.
- Multi-source/layered config, hot-reload.

## 8. Open questions

- `HOST` binding: add to config now or with http-app? → deferred to FEAT-005 (keeps this feature about *validation*, not server wiring).
