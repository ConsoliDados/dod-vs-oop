import "@ddd-dod/types/globals";
import { bootstrap, formatBootstrapError } from "./bootstrap";

/**
 * Entrypoint. `bootstrap` is error-as-value; `match` its result. On `Ok`, listen
 * and install graceful-shutdown handlers (SIGTERM/SIGINT → log → dispose → exit
 * 0). On `Err`, log the formatted reason and exit non-zero. No `throw`, no bare
 * fail-fast — the teardown is orderly (container disposers, reverse order).
 */
match(bootstrap(), {
  Ok: ({ app, port, logger, dispose }) => {
    app.listen(port, () => {
      logger.info("api listening", { port });
    });

    const shutdown = async (signal: string): Promise<void> => {
      logger.info("shutting down", { signal });
      await dispose();
      process.exit(0);
    };

    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));
  },
  Err: (error) => {
    console.error(formatBootstrapError(error));
    process.exit(1);
  },
});
