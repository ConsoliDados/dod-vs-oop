import { describe, expect, test } from "bun:test";
import { create, createSqlite } from "./index";

describe("db — driver selection from DATABASE_URL", () => {
  test("absent → sqlite :memory: handle", async () => {
    const h = create(undefined);
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

  test("a non-postgres string falls back to sqlite", async () => {
    const h = create("file:./local.db");
    expect(h.driver).toBe("sqlite");
    await h.close();
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
