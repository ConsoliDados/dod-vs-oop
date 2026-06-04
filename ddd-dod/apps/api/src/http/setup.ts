import type { config, db, logger } from "@ddd-dod/platform";
import { Elysia } from "elysia";

/** Resolved deps the HTTP layer needs (passed from the composition root). */
export interface HttpDeps {
  readonly config: config.AppConfig;
  readonly logger: logger.AppLogger;
  readonly db: db.DbHandle;
}

/**
 * The **single-source service plugin** (named-controller pattern, ADR-0014 inbound
 * layer). Decorates the cross-cutting deps and derives the per-request
 * correlation: a fresh `requestId` (also emitted as the `x-request-id` response
 * header) and a child `log` bound to it. Controllers `.use(setup)` to receive all
 * of this **typed** — no `app` is ever passed into a controller. `name` makes
 * Elysia dedupe it across controllers; `as: "scoped"` propagates the derive.
 */
export function createSetup(deps: HttpDeps) {
  return new Elysia({ name: "setup" })
    .decorate("config", deps.config)
    .decorate("db", deps.db)
    .derive({ as: "scoped" }, ({ set }) => {
      const requestId = crypto.randomUUID();
      set.headers["x-request-id"] = requestId;
      return { requestId, log: deps.logger.child({ requestId }) };
    });
}

export type Setup = ReturnType<typeof createSetup>;
