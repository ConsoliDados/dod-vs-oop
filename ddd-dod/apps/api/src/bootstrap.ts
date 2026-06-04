import {
  type AppLogger,
  type ConfigError,
  type DiError,
  formatConfigError,
  formatDiError,
  loadConfig,
} from "@ddd-dod/platform";
import { createApp } from "./app";
import { buildContainer } from "./composition-root";
import { Tokens } from "./tokens";

export type Bootstrapped = {
  app: ReturnType<typeof createApp>;
  port: number;
  logger: AppLogger;
  /** Graceful teardown: runs the container's reverse-order disposers. */
  dispose: () => Promise<void>;
};

export type BootstrapError = { Config: { error: ConfigError } } | { Wiring: { error: DiError } };

export const BootstrapError = {
  config: (error: ConfigError): BootstrapError => ({ Config: { error } }),
  wiring: (error: DiError): BootstrapError => ({ Wiring: { error } }),
};

export const formatBootstrapError = (error: BootstrapError): string =>
  match(error, {
    Config: (x) => formatConfigError(x.error),
    Wiring: (x) => formatDiError(x.error),
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
  const configResult = loadConfig(env);
  if (configResult.isErr()) {
    return Err(BootstrapError.config(configResult.value()));
  }
  const config = configResult.value();

  const container = buildContainer(config);

  const loggerResult = container.resolve(Tokens.Logger);
  if (loggerResult.isErr()) {
    return Err(BootstrapError.wiring(loggerResult.value()));
  }
  const logger = loggerResult.value();

  const app = createApp({ config });

  return Ok({
    app,
    port: config.PORT,
    logger,
    dispose: () => container.dispose(),
  });
}
