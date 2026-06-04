import { Elysia } from "elysia";
import type { Setup } from "./setup";

/**
 * Liveness + readiness. `/health` is a pure liveness check (the process is up and
 * serving). `/ready` runs the DB readiness probe (`SELECT 1`) and returns **503**
 * when it fails, so an orchestrator can gate traffic until the dependency is up.
 *
 * Standalone controller (ADR-0014 inbound layer): it `.use(setup)` for `config`,
 * `db`, and the request-scoped `log` — it never receives the `app`.
 */
export function createHealthController(setup: Setup) {
  return new Elysia({ name: "health" })
    .use(setup)
    .get("/health", ({ config }) => ({
      status: "ok" as const,
      service: "ddd-dod" as const,
      env: config.NODE_ENV,
    }))
    .get("/ready", async ({ db, log, set }) => {
      const probe = await db.probe();
      return match(probe, {
        Ok: () => ({ status: "ready" as const, checks: { db: "ok" as const } }),
        Err: () => {
          log.warn("readiness probe failed", { driver: db.driver });
          set.status = 503;
          return { status: "unready" as const, checks: { db: "down" as const } };
        },
      });
    });
}
