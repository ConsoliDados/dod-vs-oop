import { describe, expect, test } from "bun:test";
import { ConfigError, load } from "./index";

describe("loadConfig — core", () => {
  test("test env with no DB config → DATABASE_URL resolves to :memory:", () => {
    const c = load({ NODE_ENV: "test" }).unwrap();
    expect(c).toEqual({
      NODE_ENV: "test",
      PORT: 3333,
      LOG_LEVEL: "info",
      DATABASE_URL: ":memory:",
    });
  });

  test("defaults: PORT 3333 (never 3000), LOG_LEVEL info", () => {
    const c = load({ NODE_ENV: "test", PORT: "8080", LOG_LEVEL: "warn" }).unwrap();
    expect(c.PORT).toBe(8080);
    expect(c.LOG_LEVEL).toBe("warn");
  });

  test("strips unknown env keys (non-strict); only the resolved shape is exposed", () => {
    const c = load({ NODE_ENV: "test", PATH: "/usr/bin", RANDOM: "x" }).unwrap();
    expect(Object.keys(c).sort()).toEqual(["DATABASE_URL", "LOG_LEVEL", "NODE_ENV", "PORT"]);
  });

  test("freezes the parsed config", () => {
    expect(Object.isFrozen(load({ NODE_ENV: "test" }).unwrap())).toBe(true);
  });

  test("rejects non-numeric / out-of-range PORT and unknown LOG_LEVEL", () => {
    expect(load({ NODE_ENV: "test", PORT: "abc" }).isErr()).toBe(true);
    expect(load({ NODE_ENV: "test", PORT: "70000" }).isErr()).toBe(true);
    expect(load({ NODE_ENV: "test", LOG_LEVEL: "trace" }).isErr()).toBe(true);
  });
});

describe("loadConfig — DATABASE_URL resolution", () => {
  test("non-test without DATABASE_URL or DB_* parts → Err (required)", () => {
    const r = load({ NODE_ENV: "development" });
    expect(r.isErr()).toBe(true);
    expect("InvalidEnv" in r.unwrapErr()).toBe(true);
    expect(ConfigError.format(r.unwrapErr())).toContain("DATABASE_URL");
  });

  test("explicit DATABASE_URL wins — even under test env (integration tests)", () => {
    const c = load({ NODE_ENV: "test", DATABASE_URL: "postgres://u:p@h:5432/d" }).unwrap();
    expect(c.DATABASE_URL).toBe("postgres://u:p@h:5432/d");
  });

  test("builds a postgres URL from DB_* parts when DATABASE_URL is absent", () => {
    const c = load({
      NODE_ENV: "production",
      DB_HOST: "db",
      DB_PORT: "6543",
      DB_USER: "app",
      DB_PASS: "s3cr3t",
      DB_DATABASE: "ledger",
    }).unwrap();
    expect(c.DATABASE_URL).toBe("postgres://app:s3cr3t@db:6543/ledger");
  });

  test("parts: DB_PORT defaults to 5432; user/pass optional", () => {
    const c = load({ NODE_ENV: "production", DB_HOST: "db", DB_DATABASE: "ledger" }).unwrap();
    expect(c.DATABASE_URL).toBe("postgres://db:5432/ledger");
  });

  test("parts: special chars in user/pass are percent-encoded", () => {
    const c = load({
      NODE_ENV: "production",
      DB_HOST: "db",
      DB_USER: "a/b",
      DB_PASS: "p@ss:word",
      DB_DATABASE: "ledger",
    }).unwrap();
    expect(c.DATABASE_URL).toBe("postgres://a%2Fb:p%40ss%3Aword@db:5432/ledger");
  });

  test("DB_* parts never leak into AppConfig — only the resolved URL", () => {
    const c = load({ NODE_ENV: "production", DB_HOST: "db", DB_DATABASE: "ledger" }).unwrap();
    expect(Object.keys(c).sort()).toEqual(["DATABASE_URL", "LOG_LEVEL", "NODE_ENV", "PORT"]);
  });
});
