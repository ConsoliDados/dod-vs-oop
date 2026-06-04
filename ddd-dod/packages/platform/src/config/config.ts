import { defineError, type EnumValues } from "@ddd-dod/types";
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

/**
 * One validation failure, **decoupled from the validator** (ADR-0008): a flat
 * `path: message` pair, not `z.ZodIssue`. Swapping Zod for TypeBox touches only
 * the mapping in {@link loadConfig}, never the {@link ConfigError} type or any
 * consumer. `path` is dotted (`""` for the root).
 */
export type ValidationIssue = { readonly path: string; readonly message: string };

const variants = {
  invalidEnv: (issues: readonly ValidationIssue[]) => ({ InvalidEnv: { issues } }) as const,
} as const;

/**
 * Config load error (ADR-0008). Carries the neutral {@link ValidationIssue} list
 * plus its renderers (ADR-0009): `ConfigError.format` (Display, multi-line, one
 * line per issue — for the composition root to log before exiting non-zero) and
 * `ConfigError.serialize` (structured, for observability).
 */
export type ConfigError = EnumValues<typeof variants>;

export const ConfigError = defineError(variants, {
  format: (e: ConfigError) =>
    match(e, {
      InvalidEnv: (x) => {
        const lines = x.issues.map((i) => `  - ${i.path === "" ? "(root)" : i.path}: ${i.message}`);
        return `invalid configuration:\n${lines.join("\n")}`;
      },
    }),
  serialize: (e: ConfigError) =>
    match(e, {
      InvalidEnv: (x) => ({ kind: "InvalidEnv", issues: x.issues }),
    }),
});

/** Map Zod's native issues to the neutral {@link ValidationIssue} shape — the
 *  single seam that knows about Zod (swap the validator here, nowhere else). */
const toIssues = (error: z.ZodError): ValidationIssue[] =>
  error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message }));

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
    return Err(ConfigError.invalidEnv(toIssues(parsed.error)));
  }
  return Ok(Object.freeze(parsed.data));
}
