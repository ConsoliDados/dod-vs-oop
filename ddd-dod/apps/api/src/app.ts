import { Elysia } from "elysia";
import { errorEnvelope } from "./http/error-envelope";
import { createHealthController } from "./http/health.controller";
import { createSetup, type HttpDeps } from "./http/setup";

/**
 * Build the Elysia app from already-resolved dependencies (the composition root
 * resolves them and passes plain values — the app never touches the container).
 * Returns the instance without listening, so tests drive it via
 * `app.handle(new Request(...))`.
 *
 * **Named-controller composition** (ADR-0014 inbound layer): a single-source
 * `setup` plugin carries the deps + per-request correlation; a global error
 * boundary renders the envelope; each controller is `.use()`d — **no `app` is
 * passed into a controller** (so controller hooks stay encapsulated). Domain
 * context controllers mount the same way in EPIC-003.
 */
export function createApp(deps: HttpDeps) {
  const setup = createSetup(deps);
  return new Elysia().use(errorEnvelope(deps.logger)).use(createHealthController(setup));
}

export type App = ReturnType<typeof createApp>;
