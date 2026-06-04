import {
  type AppConfig,
  type Container,
  createContainer,
  createInMemoryDb,
  createLogger,
  selectSink,
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

  // Logger + its sink, built eagerly so the sink is reachable for teardown
  // (flush + dispose on shutdown — FEAT-004 / FRD-002, ADR-0007).
  const sink = selectSink({ nodeEnv: config.NODE_ENV });
  const logger = createLogger({ level: config.LOG_LEVEL, sink, context: "api" });
  container.registerValue(Tokens.Logger, logger);
  container.onDispose(async () => {
    await sink.flush();
    await sink.dispose();
  });

  container.registerValue(Tokens.Clock, systemClock);

  const db = createInMemoryDb();
  container.registerValue(Tokens.Db, db);
  container.onDispose(() => db.close());

  return container;
}
