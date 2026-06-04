# ADR-0012 — Persistence: driver-flexible Drizzle, ports + adapters (sqlite :memory: + Postgres)

- **Status:** Accepted
- **Date:** 2026-06-04
- **Milestone / Sprint:** EPIC-002 (active-foundation) — `feat/persistence` (FEAT-005)

## Context

The study runs **two persistence configs** (see `STUDY-ROADMAP.md` / `PLAN.md` §5):

- **Phase 2 — core (`sqlite :memory:`):** in-process, zero disk I/O, ephemeral — isolates the CPU/data-layout signal. Parity: the OOP foil also uses `sqlite :memory:` (PLAN §5).
- **Phase 1 — rinha (Postgres):** durable, dockerized, under hardware limits — the real-world delta.

So `ddd-dod` must talk to **both** sqlite and Postgres (env-selected), unlike the `my-approfile` recipe it adapts (Postgres-only). The hard constraint: **Drizzle schemas are dialect-bound** (`drizzle-orm/pg-core` ≠ `sqlite-core`) — there is no dialect-agnostic schema. So "one schema for both" is not free.

## Decision

1. **Driver-flexible connection, chosen from config.** A single `createDb(databaseUrl)` in `packages/platform/src/db/` picks the driver: `postgres(ql)://…` → node-postgres pool; anything else (absent) → Bun `sqlite :memory:`. `DATABASE_URL` is an optional field on `AppConfig`. The driver is chosen **only here**.

2. **Ports + adapters — not a shared schema, not a shape-factory.** The domain/application layers depend on a repository **port** (a hydrator returning plain data — SAD pattern #8), never on a Drizzle instance. Each bounded context ships **two concrete adapters** (a sqlite one and a pg one), each with its **own** dialect schema + queries. The composition root (the *dirty layer*) picks the connection by driver and wires the matching adapter. Drift between the two adapters is caught by running the **same repository contract tests** against both.

3. **Schema application differs by driver.** sqlite `:memory:` is ephemeral → its schema is **created on boot** (nothing persists between processes). Postgres is durable → schema applied via **drizzle-kit migrations** before startup. (Both land per-context in EPIC-003; the migration tooling — `drizzle.config.ts` + `db:*` scripts — lands with the first pg schema.)

4. **Result-native + lifecycle.** The handle is port-shaped (`DbHandle`: `driver`, `probe(): Promise<Result<void, DbError>>`, `close()`); `probe` is the readiness `SELECT 1` (never throws). `DbError` follows ADR-0008/0009.

## Alternatives considered

- (a) **Shared-shape factory** (define columns once → emit pg + sqlite tables, with `$type` normalization so both infer identical TS shapes) — rejected: a clever abstraction over Drizzle (against the DOD "explicit data" grain), and the real labor (inferred-type normalization) isn't worth it vs ports/adapters, which the architecture already mandates.
- (b) **Two hand-written dialect schemas + one repo over a union `Db` type** — rejected: the `BunSQLiteDatabase | NodePgDatabase` union has rough edges and still couples the repo to Drizzle. Ports keep the domain clean.
- (c) **Postgres for both phases** (Phase 2 = unlogged/`fsync=off`/tmpfs Postgres) — rejected: breaks Phase-2 parity (the foil uses `sqlite :memory:`) and is a less pure I/O-stripped isolation than in-process sqlite.
- (d) **Driver keyed on `NODE_ENV==='test'`** — rejected: Phase-2 sqlite is used in dev + micro-bench too, not only tests; key on config (`DATABASE_URL`), not scattered `process.env`.

## Consequences

- **Positive**: domain/application stay driver-agnostic (depend on the port); each adapter is concrete, explicit, isolated — no union types, no clever abstraction; the swap is one branch in the composition root; both phases' DBs are first-class.
- **Negative**: queries are written **twice** per context (sqlite + pg adapters) — accepted: each is simple (CRUD/hydrate), each phase uses one, and a shared contract test guards drift. `my-approfile` parity is partial (it's Postgres-only; we take its connection/config recipe, not its single-driver assumption).
- **Scope**: FEAT-005 delivers the **connection foundation** (driver-flexible `createDb` + config + `probe` + `DbError`). The per-context **schemas, adapters, and migration tooling** land in **EPIC-003** (ledger-core).

## References

- ADR-0001 — stack (Drizzle + sqlite); ADR-0006 — config from env; ADR-0008/0009 — error shape
- `STUDY-ROADMAP.md` / `PLAN.md` §5 — the two benchmark phases and their DBs
- `packages/platform/src/db/` — `createDb` / `createSqliteDb` / `createPgDb` / `DbError`
- `my-approfile` — the Drizzle connection/config recipe adapted here (Postgres-only there)
