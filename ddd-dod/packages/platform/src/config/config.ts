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

export type AppConfig = z.infer<typeof ConfigSchema>;

export type ConfigError = {
  readonly type: "InvalidConfig";
  readonly issues: z.ZodError["issues"];
};

/**
 * Parse + validate config. Returns `Err` instead of throwing so the composition
 * root can `match` and exit cleanly — the error-as-value discipline reaches the
 * boundary too.
 */
export function loadConfig(
  env: Record<string, string | undefined> = process.env,
): Result<AppConfig, ConfigError> {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    return Err({ type: "InvalidConfig", issues: parsed.error.issues });
  }
  return Ok(parsed.data);
}
