import { type clock, type config, type db, di, type logger } from "@ddd-dod/platform";

/**
 * DI tokens for the cross-cutting platform dependencies. Only the composition
 * root (and the Elysia app it builds) resolves these; use cases receive the
 * resolved values as parameters, never the container (ADR-0004).
 */
export const Tokens = {
  Config: di.token<config.AppConfig>("config"),
  Logger: di.token<logger.AppLogger>("logger"),
  Clock: di.token<clock.Clock>("clock"),
  Db: di.token<db.DbHandle>("db"),
} as const;
