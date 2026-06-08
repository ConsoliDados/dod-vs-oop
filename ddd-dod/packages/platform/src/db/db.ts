import { Database } from "bun:sqlite";
import { sql } from "drizzle-orm";
import { type BunSQLiteDatabase, drizzle as drizzleSqlite } from "drizzle-orm/bun-sqlite";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { DbError } from "./errors";

/**
 * Driver-flexible persistence connection (ADR-0012). The study runs two
 * persistence configs, picked from config (`DATABASE_URL`):
 *
 * - **sqlite `:memory:`** (Bun's built-in) — Phase 2 / dev / test: in-process,
 *   zero disk I/O, ephemeral (no durability; SRS §2.2). Its schema is created on
 *   boot by the caller (nothing persists between processes).
 * - **Postgres** (node-postgres pool) — Phase 1 rinha: durable; schema applied
 *   via drizzle-kit migrations before startup (EPIC-003).
 *
 * Per **ports/adapters** (ADR-0012, SAD pattern #8) the domain depends on a
 * repository *port*, never on the Drizzle instance. Each bounded context ships a
 * concrete sqlite adapter **and** a pg adapter (EPIC-003); the composition root
 * picks the connection here and wires the matching adapter — the swap lives in
 * the dirty layer, the domain stays driver-agnostic.
 */
export type DbDriver = "sqlite" | "postgres";

/** Port-shaped handle the composition root + readiness use. The concrete Drizzle
 *  instance lives on the driver-specific handle (adapters narrow by `driver`). */
export interface DbHandle {
  readonly driver: DbDriver;
  /** `SELECT 1` readiness probe. Never throws — returns `Err(DbError)`. */
  probe(): Promise<Result<void, DbError>>;
  close(): Promise<void>;
}

export interface SqliteDbHandle extends DbHandle {
  readonly driver: "sqlite";
  readonly db: BunSQLiteDatabase;
  readonly raw: Database;
}

export interface PgDbHandle extends DbHandle {
  readonly driver: "postgres";
  readonly db: NodePgDatabase;
  readonly pool: Pool;
}

async function runProbe(run: () => unknown | Promise<unknown>): Promise<Result<void, DbError>> {
  try {
    await run();
    return Ok(undefined) as Result<void, DbError>;
  } catch (cause) {
    return Err(DbError.queryFailed(cause));
  }
}

/** Bun sqlite from a `target` (default `:memory:` — Phase 2 / dev / test;
 *  ephemeral, the caller creates the schema on boot). A file path opens/creates a
 *  durable sqlite file. */
export function createSqliteDb(target = ":memory:"): SqliteDbHandle {
  const raw = new Database(target);
  raw.exec("PRAGMA foreign_keys = ON;");
  const db = drizzleSqlite(raw);
  return {
    driver: "sqlite",
    db,
    raw,
    probe: () => runProbe(() => raw.query("select 1").get()),
    close: async () => {
      raw.close();
    },
  };
}

/** node-postgres pool + drizzle (Phase 1 rinha, durable). */
export function createPgDb(url: string): PgDbHandle {
  const pool = new Pool({ connectionString: url });
  const db = drizzlePg(pool);
  return {
    driver: "postgres",
    db,
    pool,
    probe: () => runProbe(() => db.execute(sql`select 1`)),
    close: async () => {
      await pool.end();
    },
  };
}

/**
 * Pick the driver from a **resolved** `DATABASE_URL` (always present — config
 * guarantees it, ADR-0012 corrected): a `postgres(ql)://…` URL → Postgres;
 * `:memory:` or a `sqlite:`/`file:`/bare path → sqlite. This is the **only** place
 * the driver is chosen — the composition root calls it, then wires the matching
 * per-context adapters (ADR-0012). There is **no** `:memory:` fallback here: an
 * absent URL is a config `Err`, except under `test` where config resolves `:memory:`.
 */
export function createDb(databaseUrl: string): DbHandle {
  if (/^postgres(ql)?:\/\//.test(databaseUrl)) {
    return createPgDb(databaseUrl);
  }
  return createSqliteDb(sqliteTarget(databaseUrl));
}

/** Strip a `sqlite:`/`file:` scheme to a path; `:memory:` passes through. */
function sqliteTarget(databaseUrl: string): string {
  if (databaseUrl === ":memory:") {
    return ":memory:";
  }
  return databaseUrl.replace(/^(sqlite|file):(\/\/)?/, "");
}
