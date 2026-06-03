/**
 * `accounts` operational errors — Rust-enum-style union discriminated with the
 * global `match` (ADR-0002). Domain *validation* errors use the tagged
 * Notification shape from the shared kernel. Skeleton at bootstrap.
 */
export type AccountsError =
  | "AccountNotFound"
  | "AccountClosed"
  | { Frozen: { since: string } }
  | { Infra: { cause: unknown } };

export const AccountsError = {
  accountNotFound: (): AccountsError => "AccountNotFound",
  accountClosed: (): AccountsError => "AccountClosed",
  frozen: (since: string): AccountsError => ({ Frozen: { since } }),
  infra: (cause: unknown): AccountsError => ({ Infra: { cause } }),
};

export const formatAccountsError = (e: AccountsError): string =>
  match(e, {
    AccountNotFound: () => "account not found",
    AccountClosed: () => "account is closed",
    Frozen: (x) => `account is frozen since ${x.since}`,
    Infra: (x) => `infra: ${String(x.cause)}`,
  });
