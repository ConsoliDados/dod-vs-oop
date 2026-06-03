import { Database } from "bun:sqlite";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";

/**
 * Drizzle over Bun's built-in sqlite, in-process `:memory:` (ADR-0001). One
 * process owns one database; no durability beyond the process (SRS §2.2). The
 * Drizzle instance is the handle module repositories build their queries on;
 * repositories are **hydrators** that return plain snapshots (SAD pattern #8).
 */
export type Db = BunSQLiteDatabase;

export interface DbHandle {
  readonly db: Db;
  readonly raw: Database;
  close(): void;
}

export function createInMemoryDb(): DbHandle {
  const raw = new Database(":memory:");
  raw.exec("PRAGMA foreign_keys = ON;");
  const db = drizzle(raw);
  return {
    db,
    raw,
    close: () => raw.close(),
  };
}
