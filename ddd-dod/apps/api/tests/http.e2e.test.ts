import { describe, expect, test } from "bun:test";
import type { logger } from "@ddd-dod/platform";
import { config, db } from "@ddd-dod/platform";
import { createApp } from "../src/app";

/**
 * E2E for the HTTP app (FEAT-006). Drives the Elysia instance via `app.handle`
 * (no socket). Covers: liveness, DB-probing readiness (200/503), the request-id
 * middleware, and the error envelope (404/unknown). Deps are injected — the app
 * never touches the container.
 */
const cfg = config.load({ NODE_ENV: "test", PORT: "3333", LOG_LEVEL: "error" }).unwrap();

const silentLog: logger.AppLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return silentLog;
  },
};

const okDb: db.DbHandle = {
  driver: "sqlite",
  probe: async () => Ok(undefined),
  close: async () => {},
};
const downDb: db.DbHandle = {
  driver: "sqlite",
  probe: async () => Err(db.DbError.queryFailed("boom")),
  close: async () => {},
};

const build = (database: db.DbHandle = okDb) =>
  createApp({ config: cfg, logger: silentLog, db: database });

describe("http app — health & readiness", () => {
  test("GET /health → 200 liveness", async () => {
    const res = await build().handle(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", service: "ddd-dod", env: "test" });
  });

  test("GET /ready → 200 when the DB probe is Ok", async () => {
    const res = await build(okDb).handle(new Request("http://localhost/ready"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ready", checks: { db: "ok" } });
  });

  test("GET /ready → 503 when the DB probe is Err", async () => {
    const res = await build(downDb).handle(new Request("http://localhost/ready"));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "unready", checks: { db: "down" } });
  });

  test("a handled response carries an x-request-id header", async () => {
    const res = await build().handle(new Request("http://localhost/health"));
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("http app — error envelope", () => {
  test("unknown route → 404 with the stable envelope", async () => {
    const res = await build().handle(new Request("http://localhost/nope"));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("not-found");
    expect(typeof body.error.message).toBe("string");
  });
});
