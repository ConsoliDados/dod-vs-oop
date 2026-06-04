import "@ddd-dod/types/globals";
import { formatConfigError, formatDiError, loadConfig } from "@ddd-dod/platform";
import { createApp } from "./app";
import { buildContainer } from "./composition-root";
import { Tokens } from "./tokens";

/**
 * Entrypoint. Error-as-value the whole way (no throw, no fail-fast): load config,
 * wire the container, resolve the core deps — each step `match`ed. On any `Err`
 * we log and exit non-zero for now; the **graceful shutdown** (dispose the
 * container, drain in-flight) lands in FEAT-004 (app-bootstrap), which will
 * replace these bare exits with an orderly teardown.
 */
match(loadConfig(), {
  Ok: (config) => {
    const container = buildContainer(config);
    match(container.resolve(Tokens.Logger), {
      Ok: (logger) => {
        const app = createApp({ config });
        app.listen(config.PORT, () => {
          logger.info("api listening", { port: config.PORT, env: config.NODE_ENV });
        });
      },
      Err: (error) => {
        console.error(formatDiError(error));
        process.exit(1);
      },
    });
  },
  Err: (error) => {
    console.error(formatConfigError(error));
    process.exit(1);
  },
});
