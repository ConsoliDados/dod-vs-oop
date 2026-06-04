import { defineError, type EnumValues } from "@ddd-dod/types";

/**
 * `reconciliation` operational errors — Rust-enum-style union built with
 * {@link defineError} (ADR-0008), discriminated with the global `match`
 * (ADR-0002). Carries its renderers (ADR-0009): `ReconciliationError.format`
 * (Display) and `ReconciliationError.serialize` (structured). Skeleton at bootstrap.
 */
const variants = {
  batchNotFound: () => "BatchNotFound" as const,
  toleranceExceeded: (delta: number, tolerance: number) =>
    ({ ToleranceExceeded: { delta, tolerance } }) as const,
  infra: (cause: unknown) => ({ Infra: { cause } }) as const,
} as const;

export type ReconciliationError = EnumValues<typeof variants>;

export const ReconciliationError = defineError(variants, {
  format: (e: ReconciliationError) =>
    match(e, {
      BatchNotFound: () => "reconciliation batch not found",
      ToleranceExceeded: (x) => `tolerance exceeded: delta ${x.delta} > ${x.tolerance}`,
      Infra: (x) => `infra: ${String(x.cause)}`,
    }),
  serialize: (e: ReconciliationError) =>
    match(e, {
      BatchNotFound: () => ({ kind: "BatchNotFound" }),
      ToleranceExceeded: (x) => ({
        kind: "ToleranceExceeded",
        delta: x.delta,
        tolerance: x.tolerance,
      }),
      Infra: (x) => ({ kind: "Infra", cause: String(x.cause) }),
    }),
});
