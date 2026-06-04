import { config, di, type logger } from "@ddd-dod/platform";
import { createApp } from "./app";
import { buildContainer } from "./composition-root";
import { Tokens } from "./tokens";

export type Bootstrapped = {
  app: ReturnType<typeof createApp>;
  port: number;
  logger: logger.AppLogger;
  /** Graceful teardown: runs the container's reverse-order disposers. */
  dispose: () => Promise<void>;
};

export type BootstrapError =
  | { Config: { error: config.ConfigError } }
  | { Wiring: { error: di.DiError } };

export const BootstrapError = {
  config: (error: config.ConfigError): BootstrapError => ({ Config: { error } }),
  wiring: (error: di.DiError): BootstrapError => ({ Wiring: { error } }),
};

export const formatBootstrapError = (error: BootstrapError): string =>
  match(error, {
    Config: (e) => config.ConfigError.format(e.error),
    Wiring: (e) => di.DiError.format(e.error),
  });

/**
 * Compose the application as **error-as-value** (never throws): load config →
 * wire the container → resolve the core deps → build the app. Returns
 * `Err(BootstrapError)` for `main` to format and act on. Sync — there is no
 * async resource at study scale (sqlite `:memory:`). Modeled on my-approfile
 * `services/auth`, but teardown goes through `container.dispose()` (ADR-0004).
 */
export function bootstrap(
  env: Record<string, string | undefined> = process.env,
): Result<Bootstrapped, BootstrapError> {
  const configResult = config.load(env);
  if (configResult.isErr()) {
    return Err(BootstrapError.config(configResult.value()));
  }
  const appConfig = configResult.value();

  const container = buildContainer(appConfig);

  // Logger is eagerly `registerValue`d in the composition root, so read it back
  // synchronously via `peek` — keeps `bootstrap` sync. A lazily-factoried dep
  // would instead be `await container.resolve(...)`.
  const loggerResult = container.peek(Tokens.Logger);
  if (loggerResult.isErr()) {
    return Err(BootstrapError.wiring(loggerResult.value()));
  }
  const appLogger = loggerResult.value();

  const app = createApp({ config: appConfig });

  return Ok({
    app,
    port: appConfig.PORT,
    logger: appLogger,
    dispose: () => container.dispose(),
  });
}
