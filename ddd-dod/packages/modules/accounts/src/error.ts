import { defineError, type EnumValues } from "@ddd-dod/types";

/**
 * `accounts` operational errors — Rust-enum-style union built with
 * {@link defineError} (ADR-0008), discriminated with the global `match`
 * (ADR-0002). Domain *validation* errors use the tagged Notification shape from
 * the shared kernel. Carries its renderers (ADR-0009): `AccountsError.format`
 * (Display) and `AccountsError.serialize` (structured). Skeleton at bootstrap.
 */
const variants = {
  accountNotFound: () => "AccountNotFound" as const,
  accountClosed: () => "AccountClosed" as const,
  frozen: (since: string) => ({ Frozen: { since } }) as const,
  infra: (cause: unknown) => ({ Infra: { cause } }) as const,
} as const;

export type AccountsError = EnumValues<typeof variants>;

export const AccountsError = defineError(variants, {
  format: (e: AccountsError) =>
    match(e, {
      AccountNotFound: () => "account not found",
      AccountClosed: () => "account is closed",
      Frozen: (x) => `account is frozen since ${x.since}`,
      Infra: (x) => `infra: ${String(x.cause)}`,
    }),
  serialize: (e: AccountsError) =>
    match(e, {
      AccountNotFound: () => ({ kind: "AccountNotFound" }),
      AccountClosed: () => ({ kind: "AccountClosed" }),
      Frozen: (x) => ({ kind: "Frozen", since: x.since }),
      Infra: (x) => ({ kind: "Infra", cause: String(x.cause) }),
    }),
});
