import type { AppConfig, AppLogger, Clock, DbHandle } from "@ddd-dod/platform";
import { token } from "@ddd-dod/platform";

/**
 * DI tokens for the cross-cutting platform dependencies. Only the composition
 * root (and the Elysia app it builds) resolves these; use cases receive the
 * resolved values as parameters, never the container (ADR-0004).
 */
export const Tokens = {
  Config: token<AppConfig>("config"),
  Logger: token<AppLogger>("logger"),
  Clock: token<Clock>("clock"),
  Db: token<DbHandle>("db"),
} as const;
