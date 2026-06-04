import { defineError, type EnumValues } from "@ddd-dod/types";

/**
 * `statements` operational errors — Rust-enum-style union built with
 * {@link defineError} (ADR-0008), discriminated with the global `match`
 * (ADR-0002). Carries its renderers (ADR-0009): `StatementsError.format`
 * (Display) and `StatementsError.serialize` (structured). Skeleton at bootstrap.
 */
const variants = {
  accountNotFound: () => "AccountNotFound" as const,
  invalidPeriod: (from: string, to: string) => ({ InvalidPeriod: { from, to } }) as const,
  infra: (cause: unknown) => ({ Infra: { cause } }) as const,
} as const;

export type StatementsError = EnumValues<typeof variants>;

export const StatementsError = defineError(variants, {
  format: (e: StatementsError) =>
    match(e, {
      AccountNotFound: () => "account not found",
      InvalidPeriod: (x) => `invalid period: ${x.from}..${x.to}`,
      Infra: (x) => `infra: ${String(x.cause)}`,
    }),
  serialize: (e: StatementsError) =>
    match(e, {
      AccountNotFound: () => ({ kind: "AccountNotFound" }),
      InvalidPeriod: (x) => ({ kind: "InvalidPeriod", from: x.from, to: x.to }),
      Infra: (x) => ({ kind: "Infra", cause: String(x.cause) }),
    }),
});
