import { clock, type config, db, di, logger } from "@ddd-dod/platform";
import { Tokens } from "./tokens";

/**
 * The composition root: the one place that knows about concrete adapters. It
 * builds the DI container and registers the platform dependencies. Use cases
 * (added in EPIC-002) are wired here too — resolved from the container and
 * passed positionally, so the container never leaks into application code
 * (ADR-0004).
 */
export function buildContainer(appConfig: config.AppConfig): di.Container {
  const container = di.createContainer();

  container.registerValue(Tokens.Config, appConfig);

  // Logger + its sink, built eagerly so the sink is reachable for teardown
  // (flush + dispose on shutdown — FEAT-004 / FRD-002, ADR-0007).
  const sink = logger.selectSink({ nodeEnv: appConfig.NODE_ENV });
  const log = logger.create({ level: appConfig.LOG_LEVEL, sink, context: "api" });
  container.registerValue(Tokens.Logger, log);
  container.onDispose(async () => {
    await sink.flush();
    await sink.dispose();
  });

  container.registerValue(Tokens.Clock, clock.system);

  // Persistence: the driver is chosen here (dirty layer) from config —
  // sqlite `:memory:` by default, Postgres when DATABASE_URL is set (ADR-0012).
  // Per-context adapters (EPIC-003) are wired off this handle's driver.
  const database = db.create(appConfig.DATABASE_URL);
  container.registerValue(Tokens.Db, database);
  container.onDispose(() => database.close());

  return container;
}
