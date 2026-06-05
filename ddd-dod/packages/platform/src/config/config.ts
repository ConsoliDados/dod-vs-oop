import { defineError, type EnumValues } from "@ddd-dod/types";
import { z } from "zod";

/**
 * Process configuration parsed from the environment — an **external untrusted
 * boundary**, so it goes through Zod (ADR-0006). The schema strips unknown env
 * keys (not `.strict()`: `process.env` legitimately carries hundreds of
 * unrelated keys). `PORT` defaults to `3333` — never `3000`, which is reserved
 * for a frontend.
 *
 * **Persistence (ADR-0012, corrected 2026-06-04).** `:memory:` is **test-only**,
 * never a general fallback. `DATABASE_URL` is **required when `NODE_ENV !== test`**
 * and is *resolved* here (see {@link loadConfig}): an explicit `DATABASE_URL` wins
 * (any env) → else a Postgres URL is **built from the `DB_*` parts** → else, under
 * `test`, it falls back to `:memory:` → otherwise the load is an `Err`. The `DB_*`
 * parts are inputs only — they never appear on {@link AppConfig}.
 */
const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(3333),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().optional(),
  DB_PORT: z.coerce.number().int().positive().max(65535).optional(),
  DB_USER: z.string().optional(),
  DB_PASS: z.string().optional(),
  DB_DATABASE: z.string().optional(),
});

type RawConfig = z.infer<typeof ConfigSchema>;

/** The resolved, frozen config the app runs on. `DATABASE_URL` is always present
 *  (resolved per ADR-0012); the `DB_*` input parts are not surfaced. */
export type AppConfig = Readonly<{
  NODE_ENV: RawConfig["NODE_ENV"];
  PORT: number;
  LOG_LEVEL: RawConfig["LOG_LEVEL"];
  DATABASE_URL: string;
}>;

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
  const c = parsed.data;
  const databaseUrl = resolveDatabaseUrl(c);
  if (databaseUrl === null) {
    return Err(
      ConfigError.invalidEnv([
        {
          path: "DATABASE_URL",
          message:
            "required when NODE_ENV is not 'test' — set DATABASE_URL, or DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_DATABASE",
        },
      ]),
    );
  }
  return Ok(
    Object.freeze({
      NODE_ENV: c.NODE_ENV,
      PORT: c.PORT,
      LOG_LEVEL: c.LOG_LEVEL,
      DATABASE_URL: databaseUrl,
    }),
  );
}

/**
 * Resolve `DATABASE_URL` (ADR-0012, corrected): an explicit URL wins → else build
 * a Postgres URL from the `DB_*` parts → else `:memory:` under `test` → else
 * `null` (the caller turns it into a required-config `Err`). `:memory:` is
 * **never** a non-test fallback.
 */
function resolveDatabaseUrl(c: RawConfig): string | null {
  if (c.DATABASE_URL) {
    return c.DATABASE_URL;
  }
  const fromParts = buildPostgresUrl(c);
  if (fromParts) {
    return fromParts;
  }
  return c.NODE_ENV === "test" ? ":memory:" : null;
}

/** Assemble `postgres://user:pass@host:port/database` from the `DB_*` parts. Needs
 *  at least `DB_HOST` + `DB_DATABASE`; `DB_PORT` defaults to 5432; user/pass are
 *  optional and percent-encoded. Returns `null` if the essentials are absent. */
function buildPostgresUrl(c: RawConfig): string | null {
  if (!c.DB_HOST || !c.DB_DATABASE) {
    return null;
  }
  const port = c.DB_PORT ?? 5432;
  const auth = c.DB_USER
    ? `${encodeURIComponent(c.DB_USER)}${c.DB_PASS ? `:${encodeURIComponent(c.DB_PASS)}` : ""}@`
    : "";
  return `postgres://${auth}${c.DB_HOST}:${port}/${c.DB_DATABASE}`;
}
