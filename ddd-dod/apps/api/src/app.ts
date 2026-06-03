import type { Container } from "@ddd-dod/platform";
import { Elysia } from "elysia";
import { Tokens } from "./tokens";

/**
 * Build the Elysia app from a wired container. Returns the instance without
 * listening, so tests can drive it via `app.handle(new Request(...))`. Context
 * routes (accounts/ledger/...) mount here in EPIC-002; at bootstrap only the
 * health endpoint exists.
 */
export function createApp(container: Container) {
  const config = container.resolve(Tokens.Config);

  return new Elysia().get("/health", () => ({
    status: "ok" as const,
    service: "ddd-dod",
    env: config.NODE_ENV,
  }));
}
