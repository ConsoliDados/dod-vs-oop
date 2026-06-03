/**
 * `reconciliation` operational errors — Rust-enum-style union discriminated with
 * the global `match` (ADR-0002). Skeleton at bootstrap.
 */
export type ReconciliationError =
  | "BatchNotFound"
  | { ToleranceExceeded: { delta: number; tolerance: number } }
  | { Infra: { cause: unknown } };

export const ReconciliationError = {
  batchNotFound: (): ReconciliationError => "BatchNotFound",
  toleranceExceeded: (delta: number, tolerance: number): ReconciliationError => ({
    ToleranceExceeded: { delta, tolerance },
  }),
  infra: (cause: unknown): ReconciliationError => ({ Infra: { cause } }),
};

export const formatReconciliationError = (e: ReconciliationError): string =>
  match(e, {
    BatchNotFound: () => "reconciliation batch not found",
    ToleranceExceeded: (x) => `tolerance exceeded: delta ${x.delta} > ${x.tolerance}`,
    Infra: (x) => `infra: ${String(x.cause)}`,
  });
