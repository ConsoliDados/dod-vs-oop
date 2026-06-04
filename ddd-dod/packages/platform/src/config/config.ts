import { z } from "zod";

/**
 * Process configuration parsed from the environment — an **external untrusted
 * boundary**, so it goes through Zod (ADR-0006). The schema strips unknown env
 * keys (not `.strict()`: `process.env` legitimately carries hundreds of
 * unrelated keys). `PORT` defaults to `3333` — never `3000`, which is reserved
 * for a frontend.
 */
const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(3333),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type AppConfig = Readonly<z.infer<typeof ConfigSchema>>;

export type ConfigError = {
  readonly type: "InvalidConfig";
  readonly issues: z.ZodError["issues"];
};

/**
 * Parse + validate config. Returns `Err` instead of throwing so the composition
 * root can `match` and exit cleanly — the error-as-value discipline reaches the
 * boundary too (ADR-0005). The parsed config is frozen: immutable in the type
 * and at runtime.
 */
export function loadConfig(
  env: Record<string, string | undefined> = process.env,
): Result<AppConfig, ConfigError> {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    return Err({ type: "InvalidConfig", issues: parsed.error.issues });
  }
  return Ok(Object.freeze(parsed.data));
}

/**
 * Render a {@link ConfigError} as a human-readable, multi-line message for the
 * composition root to log before exiting non-zero — one line per Zod issue
 * (`path: message`). Keeps the boot failure legible instead of dumping raw issues.
 */
export function formatConfigError(error: ConfigError): string {
  const lines = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.map(String).join(".") : "(root)";
    return `  - ${path}: ${issue.message}`;
  });
  return `invalid configuration:\n${lines.join("\n")}`;
}
