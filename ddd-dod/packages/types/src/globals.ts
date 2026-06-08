/**
 * Side-effect entry that registers the `@consolidados/results` value-globals
 * (`Ok`, `Err`, `Some`, `None`, `match`) on `globalThis` (ADR-0005).
 *
 * Import **once** at each runtime entry surface — never in a domain/library
 * module:
 *
 *   // apps/api/src/main.ts        (first import)
 *   import "@ddd-dod/types/globals";
 *
 *   // bun test                    (via bunfig.toml `[test].preload`)
 *   import "@ddd-dod/types/globals";
 *
 * Pair with `"types": ["@ddd-dod/types/globals-types"]` in tsconfig so the
 * compiler also sees `Result<T, E>` / `Option<T>` as ambient types
 * (see `globals-types.d.ts`).
 */
import "@consolidados/results";
