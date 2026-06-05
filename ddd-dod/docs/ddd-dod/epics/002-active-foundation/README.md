---
id: EPIC-002
slug: active-foundation
type: infra
status: planned
owner: Johnny Carreiro
milestone: MILESTONE-001 (bootstrap)
target_window: 2026-06-03 .. TBD
sdd: null
feature_placement: B
exits_with:
  - config loader (Zod env, Result, PORT default 3333) shipped + tested
  - functional logger (sinks, redaction, request-scoped child) shipped + tested
  - token-based DI container (lifecycle + dispose + test substitution) shipped + tested
  - bootstrap() runtime (compose + graceful shutdown) shipped + tested
  - Elysia app (Err->HTTP envelope, request-id middleware, health/readiness) shipped + tested
  - bun run check clean; bun test green; app boots + shuts down cleanly
---

# EPIC-002 — active-foundation

> **Infra epic** under MILESTONE-001 (bootstrap). Cross-cutting → references **no** SDD. The **living runtime foundation**: the parts a classic stack (NestJS) hands over pre-built — logger, DI container, app factory, lifecycle — implemented explicitly here. Builds on the EPIC-001 skeletons, replacing "compiles + boots minimal" with "production-shaped + tested".

## Why

`ddd-dod` deliberately forgoes a batteries-included framework (ADR-0001). That means the runtime foundation is ours to build: configuration, structured logging, dependency wiring, the startup/shutdown sequence, and the HTTP app with a consistent error contract. Doing this as explicit, tested features (rather than letting a framework hide it) is part of what the study measures and documents.

## Feature placement

**Mode B (epic-bound)** — features live at `epics/002-active-foundation/features/<slug>/` (the live build trail + code); each feature's spec is a flat FRD at `architecture/frds/frd-<slug>.md` (written when the feature is picked up — RPA as mental discipline). Sprint planning is collapsed into this README.

## Features

Each feature = one FRD = one `feat/<slug>` branch (merged locally into `epic/active-foundation`).

| # | Feature | `feat/` branch | Intent | Depends on |
|---|---------|----------------|--------|-----------|
| FEAT-001 | config | `feat/config` | Typed env loader via Zod (`AppConfig`); failure as `Result` (no throw); `PORT` default 3333, never 3000 (ADR-0006) | — |
| FEAT-002 | logger | `feat/logger` | Functional structured logger: levels, console sink (json/pretty), key redaction, `child`/request-correlation. Functional style of the `my-approfile` logger; **not** the singleton/class style of the `conecta` logger | — |
| FEAT-003 | di-container | `feat/di-container` | Token-based container hardened: lazy singletons, `dispose` on shutdown, test substitution; composition-root-only (ADR-0004) | — |
| FEAT-004 | app-bootstrap | `feat/app-bootstrap` | The `bootstrap()` runtime: compose config → logger → container → app; graceful shutdown (SIGINT/SIGTERM); lifecycle/dispose ordering | 001, 002, 003 |
| FEAT-005 | persistence | `feat/persistence` | Driver-flexible Drizzle DB: `:memory:` sqlite (Phase 2 / dev / test) **+** Postgres (Phase 1 rinha), **env-selected**; drizzle-kit config + migrations; `DATABASE_URL` in config (ADR-0012). Adapts the `my-approfile` Drizzle recipe (Postgres-only) to dual-driver | 001 |
| FEAT-006 | http-app | `feat/http-app` | Elysia app: `Err`→HTTP error envelope (SRS NFR-OBS-001), request-id + request-scoped logger middleware, health/readiness endpoints (readiness probes the DB), 404/422/500 shapes | 002, 004, 005 |

Dependency order: **001 → (002, 003, 005 in parallel) → 004 → 006**.

## Out of scope

- Any domain feature (ledger/accounts/statements/reconciliation) — EPIC-003 (ledger-core).
- Outbox dispatcher runtime — deferred to the ledger-core milestone (only ports exist).
- Auth/security — out of study scope (SRS §2.2).

## Cross-project references (by name, never by path)

Per playbook §20 and the workspace reverse-boundary, docs here reference other projects by **name/role only**:
- **`my-approfile`** — the reference for the functional logger shape (factory + immutable `child`, no class).
- **`conecta`** — the anti-reference: a class/singleton logger to avoid.
- **`ddd-classic`** — the OOP foil; its NestJS-provided equivalents (DI, app factory, lifecycle) are what these features build by hand.

## Exits with

- [x] FEAT-001 config — shipped + tested
- [x] FEAT-002 logger — shipped + tested
- [x] FEAT-003 di-container — shipped + tested
- [x] FEAT-004 app-bootstrap — shipped + tested
- [x] FEAT-005 persistence — shipped + tested
- [x] FEAT-006 http-app — shipped + tested
- [ ] `bun run check` clean; `bun test` green; app boots and shuts down cleanly
- [ ] Epic PR'd into `milestone/bootstrap`

## Progress log

- 2026-06-03 — Epic planned; five features scoped (config, logger, di-container, app-bootstrap, http-app), dependency-ordered. FRDs to be written per-feature as each is picked up.
- 2026-06-03 — FEAT-001 config shipped (`feat/config`): FRD-001 + hardened loader (`Readonly`/`Object.freeze`, non-strict env per ADR-0006) + `formatConfigError` + `main.ts` wiring + 8 tests. `bun run check` clean; `bun test` 23/23; boot prints a per-issue error on bad `PORT` and exits 1. Merged locally into `epic/active-foundation`.
- 2026-06-04 — FEAT-004 app-bootstrap shipped (`feat/app-bootstrap`, ref my-approfile `services/auth`): `bootstrap(env): Result<Bootstrapped, BootstrapError>` (never throws) + `formatBootstrapError`; `container.onDispose(fn)`; composition root wires sink flush+dispose & db close; `main.ts` graceful shutdown (SIGTERM/SIGINT → log → `dispose()` → exit 0). Smoke-verified the full shutdown path. 3 new tests. `bun run check` clean; `bun test` 36/36. Merged locally into `epic/active-foundation`. **4/5 features done** — only FEAT-005 (http-app) left.
- 2026-06-04 — FEAT-003 di-container shipped (`feat/di-container`): ADR-0004 **amended** (Result-native, never-throws, disposable, reusable). `resolve` → `Result<T, DiError>` (NotRegistered/CircularDependency/FactoryFailed), singleton+transient, `dispose` reverse-order swallow+log; `app.ts` now takes resolved deps, `main.ts` threads the Result via `match`. 4 new tests. Better than the `conecta` reference but functional (no class/static singleton). `bun run check` clean; `bun test` 33/33. Merged locally into `epic/active-foundation`. (Graceful shutdown wiring → FEAT-004.)
- 2026-06-03 — ADR-0007 (observability stack: OTel + Grafana LGTM) accepted. FEAT-002 logger shipped (`feat/logger`): FRD-002 + `createOtlpLogSink` (LogRecord → OTel logs data model, severity 5/9/13/17, never-throws) + `selectSink` (env transport) + composition-root wiring + 6 tests. Verified dev→console pretty, prod→console JSON (OTLP when an emitter is injected). `bun run check` clean; `bun test` 29/29. Merged locally into `epic/active-foundation`. (Full OTel SDK/metrics/traces/compose → observability epic.)
- 2026-06-04 — Refinement pass `feat/platform-conventions` merged locally (**not a numbered feature** — cross-cutting lapidation; FEAT-005 http-app still pending). Error-as-value house style: `defineError` + `EnumValues` (validator-neutral payloads, `ValidationIssue` not `z.ZodIssue[]`), `.format` (Display) vs `.serialize` (structured `ErrorJson`) bundled on the error; ESM **namespace barrels** for `platform` (`config.load`, `di.createContainer`, …). ADR-0008/0009/0010. 7 error enums migrated; `@ddd-dod/types` grew a `.` entry for the helpers. Project playbook copies corrected (`playbook-ts §3/§5/§6`, `playbook-base §10.6`); `PLAYBOOK-LEARNINGS.md` reconciled. `bun run check` clean; `bun test` 41/41.
- 2026-06-04 — DI hardening pass started (`feat/di-hardening`, refines FEAT-003 toward an extractable `@consolidados/di` lib). Scope: (a) transient-`Disposable` teardown leak fix; (b) all-async "magic" `resolve` (factory `T | Promise<T>`) + single-flight + ancestor-chain cycle detection + sync `peek`; (c) `createScope()` + `scoped` lifetime, and a separate worker-pool helper. TDD-first.
- 2026-06-04 — DI hardening **shipped** (`feat/di-hardening`, ADR-0011). Container: all-async magic `resolve` + single-flight + ancestor-chain cycle detection + sync `peek`; lifetimes singleton|scoped|transient + `createScope()`; transient-`Disposable` teardown leak fixed (`DiError.NotResolved` added for `peek`). Share-nothing **worker-pool** (`createWorkerPool`/`serveWorker`) **separate** from the DI (no `Worker`/`postMessage` coupling), with a real Bun Worker test. Coverage filled (logger error-serialization + redaction depth, config multi-issue). **Unit tests co-located** with source per AGENTS — `tests/` is now integration/E2E only (`apps/api/tests/`). `bun run check` clean; `bun test` 65/65. Merged locally into `epic/active-foundation`.
- 2026-06-04 — FEAT-005 **persistence** shipped (`feat/persistence`, ADR-0012; renumbered http-app → FEAT-006). Driver-flexible Drizzle connection picked from config `DATABASE_URL`: `createDb()` → sqlite `:memory:` (Phase 2 / dev / test) or Postgres (`pg` pool, Phase 1 rinha). Port-shaped `DbHandle` (`driver`/`probe`=`SELECT 1`/`close`), `DbError` (ADR-0008/0009); composition root swaps the driver in the dirty layer. **Decision: ports/adapters, not a shared schema/factory** (SAD #8) — schemas + per-context sqlite/pg adapters + migration tooling land in EPIC-003. Adapts the `my-approfile` Drizzle recipe (Postgres-only) to dual-driver. 6 new tests. `bun run check` clean; `bun test` 71/71. (`@types/pg` to be moved deps→devDeps — trivial.)
- 2026-06-04 — `demo/worker-di-pool` **merged into the epic** (no longer isolated): it's the **seed for the Phase-3 parallelism axis** — `ddd-dod` vs `ddd-dod`+thread-workers, plus the qualitative "why `ddd-classic` can't easily use workers" post angle (`STUDY-ROADMAP.md` Phase 3 + examples-root `BENCHMARKS.md` "Extra — parallelism"). `bun test` 72/72.
- 2026-06-04 — **Infra placement & per-tier folder organization** decided (ADR-0014, refines ADR-0012 + SAD §2/§4) ahead of FEAT-006/EPIC-003. Named the **three "infra"s** — inbound (HTTP routes → `apps/api/src/http`), outbound (persistence adapters → a single `@ddd-dod/infra`, subpath per ctx), technical ports (→ `platform`). **Core package = `domain` + `application` only, provably infra-free** (port in `application`). Scales prototype→medium(←us)→large. SAD §2/§4 updated; logged for template fold-back in new **`architecture/playbook/PLAYBOOK-LEARNINGS.md` (L-001)** + OQ-001 index (refines playbook §5.1/§5.2 + adds the missing tier axis to §21). **Decision only — no code; `@ddd-dod/infra` + adapters land in EPIC-003.** FEAT-006 is the first inbound-adapter-in-app instance.
- 2026-06-04 — Worker-pool **dispatch strategy** extracted (`feat/worker-pool-dispatch`, ADR-0013 refining ADR-0011). The pool's hardcoded round-robin became a **pluggable `DispatchStrategy` seam** (pool owns transport + reply correlation; strategy owns *which worker, when*, via a `DispatchContext` — never sees `Worker`/`postMessage`). Ships **`fifoBackpressure()`** — one in-flight job per worker + FIFO queue, the pool **default** (correct for CPU-bound `statements`/`reconciliation`) — and **`roundRobin()`**, kept as the naive **study baseline** (not deleted). Strategies unit-tested in isolation against a **fake transport** (deterministic concurrency invariants); real-worker path unchanged. Additive API (existing callers get FIFO-backpressure for free). TDD-first. `bun run check` clean; `bun test` 76/76. **First case logged so it's not lost; `leastLoaded()` deferred (ADR-0013 alt-d) for I/O-flavored worker tasks.**
- 2026-06-04 — **FEAT-006 http-app shipped** (`feat/http-app`, FRD-006). The Elysia boundary built with the **named-controller pattern** (ADR-0014 inbound layer): a single-source `setup` plugin (`name: "setup"`) decorates `config`/`db` + a `scoped` derive (`requestId`, child `log`, `x-request-id` header); standalone controllers `.use(setup)` — **no `app` passed into a controller** (validated end-to-end in a typed spike incl. plugin/macro `hasAuth` gating). Global `errorEnvelope` onError maps `NOT_FOUND`/`VALIDATION`/`PARSE`→404/422/400, else **500** (logged w/ requestId, cause not leaked); shape `{ error: { code, message }, requestId? }`. `/health` liveness + `/ready` (DB probe → 200/503). `bootstrap` now peeks `Tokens.Db` and threads `{config, logger, db}` into `createApp`. E2E via `app.handle` (injected deps). `bun run check` clean; `bun test` 80/80. **EPIC-002 feature set complete (6/6).**
- 2026-06-04 — **Fix: `:memory:` is test-only, not a general DB default** (`fix/db-url-resolution`, **ADR-0012 corrected** — amended in place, it was a mis-recorded rule not a pivot). Config now **resolves** `DATABASE_URL`: explicit URL wins (any env) → else builds `postgres://…` from `DB_*` parts (`DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASS`/`DB_DATABASE`, port→5432, creds percent-encoded) → else `:memory:` under `test` → else **`Err` (required when `NODE_ENV !== test`)**. `createDb` lost its `:memory:` fallback and now maps a resolved URL→driver (`postgres://`→pg; `:memory:`/`sqlite:`/`file:`/path→sqlite); `AppConfig.DATABASE_URL` is now a required `string` (parts never surfaced). Enables per-env-file host/port/creds for multiple container sets; unit tests mock the port, integration tests set `DATABASE_URL`. SAD §5 + composition-root comment updated. Smoke: dev w/o DB → config `Err`; dev w/ `DB_*` → boots on built pg URL. `bun run check` clean; `bun test` 81/81.
