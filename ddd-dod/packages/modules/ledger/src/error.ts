/**
 * `ledger` operational errors — Rust-enum-style union (string variants + single-
 * key object variants), constructed via the companion factory and discriminated
 * with the global `match` (ADR-0002). Domain *validation* errors use the tagged
 * Notification shape (`InvalidProperty[]`) from the shared kernel; this union is
 * for use-case / port outcomes. Skeleton at bootstrap — grows in EPIC-002.
 */
export type LedgerError =
  | "TransactionNotFound"
  | "UnbalancedTransaction"
  | { CurrencyMismatch: { expected: string; got: string } }
  | { Infra: { cause: unknown } };

export const LedgerError = {
  transactionNotFound: (): LedgerError => "TransactionNotFound",
  unbalancedTransaction: (): LedgerError => "UnbalancedTransaction",
  currencyMismatch: (expected: string, got: string): LedgerError => ({
    CurrencyMismatch: { expected, got },
  }),
  infra: (cause: unknown): LedgerError => ({ Infra: { cause } }),
};

export const formatLedgerError = (e: LedgerError): string =>
  match(e, {
    TransactionNotFound: () => "transaction not found",
    UnbalancedTransaction: () => "transaction postings are not balanced",
    CurrencyMismatch: (x) => `currency mismatch: expected ${x.expected}, got ${x.got}`,
    Infra: (x) => `infra: ${String(x.cause)}`,
  });
