import "@ddd-dod/types/globals";
import { formatConfigError, loadConfig } from "@ddd-dod/platform";
import { createApp } from "./app";
import { buildContainer } from "./composition-root";
import { Tokens } from "./tokens";

/**
 * Entrypoint. Loads config (error-as-value: `Err` → exit non-zero), wires the
 * container at the composition root, then starts Elysia on the configured
 * `PORT` (default 3333; never 3000). The single `match` is the boundary's one
 * branch — the use-case discipline (no `if (result.isErr())`) applied here too.
 */
match(loadConfig(), {
  Ok: (config) => {
    const container = buildContainer(config);
    const logger = container.resolve(Tokens.Logger);
    const app = createApp(container);
    app.listen(config.PORT, () => {
      logger.info("api listening", { port: config.PORT, env: config.NODE_ENV });
    });
  },
  Err: (error) => {
    console.error(formatConfigError(error));
    process.exit(1);
  },
});
