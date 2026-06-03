/**
 * `statements` operational errors — Rust-enum-style union discriminated with the
 * global `match` (ADR-0002). Skeleton at bootstrap.
 */
export type StatementsError =
  | "AccountNotFound"
  | { InvalidPeriod: { from: string; to: string } }
  | { Infra: { cause: unknown } };

export const StatementsError = {
  accountNotFound: (): StatementsError => "AccountNotFound",
  invalidPeriod: (from: string, to: string): StatementsError => ({
    InvalidPeriod: { from, to },
  }),
  infra: (cause: unknown): StatementsError => ({ Infra: { cause } }),
};

export const formatStatementsError = (e: StatementsError): string =>
  match(e, {
    AccountNotFound: () => "account not found",
    InvalidPeriod: (x) => `invalid period: ${x.from}..${x.to}`,
    Infra: (x) => `infra: ${String(x.cause)}`,
  });
