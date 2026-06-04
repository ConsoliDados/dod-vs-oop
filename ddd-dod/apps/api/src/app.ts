import type { AppConfig } from "@ddd-dod/platform";
import { Elysia } from "elysia";

/**
 * Build the Elysia app from already-resolved dependencies (the composition root
 * resolves them and passes plain values — the app never touches the container).
 * Returns the instance without listening, so tests drive it via
 * `app.handle(new Request(...))`. Context routes mount here in EPIC-003; at
 * bootstrap only the health endpoint exists.
 */
export function createApp(deps: { config: AppConfig }) {
  return new Elysia().get("/health", () => ({
    status: "ok" as const,
    service: "ddd-dod",
    env: deps.config.NODE_ENV,
  }));
}
