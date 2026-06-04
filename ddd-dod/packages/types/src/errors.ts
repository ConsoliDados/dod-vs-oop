/**
 * Error-as-value primitives shared by every package (ADR-0008, ADR-0009).
 *
 * The house style for an error is a **Rust-enum-style tagged union** built from
 * a const object of variant constructors, paired with two renderers that travel
 * *with* the error, class-like:
 *
 *   - `format(e): string`     — **Display** (Rust parallel): human-readable, one
 *                               line, for boot/CLI logs. Never for API bodies.
 *   - `serialize(e): ErrorJson` — **structured**: a flat, serializable record for
 *                               observability (logs/metrics fields). Never a
 *                               string blob.
 *
 * {@link defineError} fuses the variant constructors with those two renderers on
 * a single object and — crucially — its signature *requires* both, so no error
 * can be defined without them ("segurança total na utilização"). The derivation
 * of the union *type* runs over the variants object alone (see {@link EnumValues}),
 * so `format`/`serialize` never leak into the error's value type.
 */

/**
 * Derive the discriminated-union type from a const object of variants that mix:
 *   - bare-value variants (no payload):        `accountClosed: () => "AccountClosed" as const`
 *   - factory-function variants (with payload): `frozen: (since: string) => ({ Frozen: { since } }) as const`
 *
 * Each function key contributes its **return type**; each non-function key
 * contributes its value. Adding a variant to the const object automatically
 * extends the union — and removing the matching `match` arm becomes a type error.
 */
export type EnumValues<T> = {
  [K in keyof T]: T[K] extends (...args: never[]) => infer R ? R : T[K];
}[keyof T];

/**
 * The structured, serializable form of an error-as-value — what `serialize`
 * returns. Deliberately **not** the logger's `LogFields`: keeping it a neutral
 * record means a domain error (e.g. in `shared-kernel`) never has to depend on
 * the platform logger's vocabulary. `kind` is the variant tag; the rest is the
 * variant's (already-safe) payload, with `unknown` causes pre-stringified.
 */
export type ErrorJson = { readonly kind: string } & Readonly<Record<string, unknown>>;

/**
 * Shape a variants object must satisfy: each key is either a bare tag string or a
 * constructor. Constructors may return a **string** (nullary tag variant, e.g.
 * `() => "AccountNotFound"`) or an **object** (payload variant, e.g.
 * `(since) => ({ Frozen: { since } })`).
 */
type ErrorVariants = Record<string, string | ((...args: never[]) => string | object)>;

/** The two renderers every error carries. Generic over the error's union type. */
export interface ErrorRenderers<E> {
  /** Display: human-readable, single line — boot/CLI logs only. */
  format: (error: E) => string;
  /** Structured: flat serializable record — observability. */
  serialize: (error: E) => ErrorJson;
}

/**
 * Build the class-like error object: variant constructors + `format` + `serialize`
 * on one frozen value. The renderers are **required** by the signature.
 *
 * Pair it with a type alias derived from the *variants alone* so the renderers
 * stay out of the union:
 *
 * ```ts
 * const variants = {
 *   notRegistered: (token: string) => ({ NotRegistered: { token } }) as const,
 * } as const;
 * export type DiError = EnumValues<typeof variants>;
 * export const DiError = defineError(variants, {
 *   format: (e) => match(e, { NotRegistered: (x) => `no provider for "${x.token}"` }),
 *   serialize: (e) => match(e, { NotRegistered: (x) => ({ kind: "NotRegistered", token: x.token }) }),
 * });
 * // DiError.notRegistered("db")  → construct
 * // DiError.format(e) / DiError.serialize(e)  → render
 * ```
 */
export function defineError<const V extends ErrorVariants, E = EnumValues<V>>(
  variants: V,
  renderers: ErrorRenderers<E>,
): Readonly<V & ErrorRenderers<E>> {
  return Object.freeze({ ...variants, ...renderers });
}
