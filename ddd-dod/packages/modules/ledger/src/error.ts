import { defineError, type EnumValues } from "@ddd-dod/types";

/**
 * `ledger` operational errors — Rust-enum-style union (string variants + single-
 * key object variants) built with {@link defineError} (ADR-0008) and discriminated
 * with the global `match` (ADR-0002). Domain *validation* errors use the tagged
 * Notification shape (`InvalidProperty[]`) from the shared kernel; this union is
 * for use-case / port outcomes. Carries its renderers (ADR-0009):
 * `LedgerError.format` (Display) and `LedgerError.serialize` (structured).
 * Skeleton at bootstrap — grows in EPIC-002.
 */
const variants = {
  transactionNotFound: () => "TransactionNotFound" as const,
  unbalancedTransaction: () => "UnbalancedTransaction" as const,
  currencyMismatch: (expected: string, got: string) =>
    ({ CurrencyMismatch: { expected, got } }) as const,
  infra: (cause: unknown) => ({ Infra: { cause } }) as const,
} as const;

export type LedgerError = EnumValues<typeof variants>;

export const LedgerError = defineError(variants, {
  format: (e: LedgerError) =>
    match(e, {
      TransactionNotFound: () => "transaction not found",
      UnbalancedTransaction: () => "transaction postings are not balanced",
      CurrencyMismatch: (x) => `currency mismatch: expected ${x.expected}, got ${x.got}`,
      Infra: (x) => `infra: ${String(x.cause)}`,
    }),
  serialize: (e: LedgerError) =>
    match(e, {
      TransactionNotFound: () => ({ kind: "TransactionNotFound" }),
      UnbalancedTransaction: () => ({ kind: "UnbalancedTransaction" }),
      CurrencyMismatch: (x) => ({ kind: "CurrencyMismatch", expected: x.expected, got: x.got }),
      Infra: (x) => ({ kind: "Infra", cause: String(x.cause) }),
    }),
});
