/**
 * `@ddd-dod/types` value/type surface (the **non-globals** part).
 *
 * The results globals (`Result`/`Option` types + `Ok`/`Err`/`Some`/`None`/`match`
 * values) ship separately via the `./globals` (runtime) and `./globals-types`
 * (ambient types) entry points — never from here, so importing these helpers
 * pulls in no side-effects. This entry exposes the error-as-value primitives
 * (ADR-0008/0009) that every package builds its errors with.
 */
export { defineError, type EnumValues, type ErrorJson, type ErrorRenderers } from "./errors";
