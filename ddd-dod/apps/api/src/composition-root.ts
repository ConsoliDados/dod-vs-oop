import {
  type AppConfig,
  type Container,
  createConsoleSink,
  createContainer,
  createInMemoryDb,
  createLogger,
  systemClock,
} from "@ddd-dod/platform";
import { Tokens } from "./tokens";

/**
 * The composition root: the one place that knows about concrete adapters. It
 * builds the DI container and registers the platform dependencies. Use cases
 * (added in EPIC-002) are wired here too — resolved from the container and
 * passed positionally, so the container never leaks into application code
 * (ADR-0004).
 */
export function buildContainer(config: AppConfig): Container {
  const container = createContainer();

  container.registerValue(Tokens.Config, config);

  container.register(Tokens.Logger, () =>
    createLogger({
      level: config.LOG_LEVEL,
      sink: createConsoleSink({ format: config.NODE_ENV === "production" ? "json" : "pretty" }),
      context: "api",
    }),
  );

  container.registerValue(Tokens.Clock, systemClock);

  container.register(Tokens.Db, () => createInMemoryDb());

  return container;
}
