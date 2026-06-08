import { describe, expect, test } from "bun:test";
import { unlinkSync } from "node:fs";
import { create, createSqlite } from "./index";

describe("db — driver selection from a resolved DATABASE_URL", () => {
  test(":memory: → sqlite handle", async () => {
    const h = create(":memory:");
    expect(h.driver).toBe("sqlite");
    await h.close();
  });

  test("a postgres:// URL → postgres handle (pool is lazy — not connected)", async () => {
    const h = create("postgres://user:pass@localhost:5432/db");
    expect(h.driver).toBe("postgres");
    await h.close();
  });

  test("postgresql:// is recognized too", async () => {
    const h = create("postgresql://localhost/db");
    expect(h.driver).toBe("postgres");
    await h.close();
  });

  test("a sqlite file URL → sqlite handle (opens the file)", async () => {
    const path = `/tmp/ddd-dod-db-${process.pid}.db`;
    const h = create(`file:${path}`);
    expect(h.driver).toBe("sqlite");
    await h.close();
    try {
      unlinkSync(path);
    } catch {
      // best-effort cleanup
    }
  });
});

describe("db — sqlite probe (never throws)", () => {
  test("probe() is Ok on a live :memory: db", async () => {
    const h = createSqlite();
    expect((await h.probe()).isOk()).toBe(true);
    await h.close();
  });

  test("probe() is Err(QueryFailed) after close", async () => {
    const h = createSqlite();
    await h.close();
    const result = await h.probe();
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toHaveProperty("QueryFailed");
  });
});
