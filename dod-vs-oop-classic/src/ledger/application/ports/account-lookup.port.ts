import type { Currency } from '../../../shared/value-objects'

/** Minimal, ledger-local view of an account (anti-corruption — no `accounts/domain` import). */
export interface AccountView {
  id: string
  currency: Currency
}

/**
 * Cross-context read port: the `ledger` needs an account's currency (and its
 * existence) to post against it, but must not import `accounts/domain` (SAD §4).
 * Implemented as an ACL in `ledger/infrastructure`, returning the local
 * {@link AccountView} (or `null` when the account is absent / soft-deleted).
 */
export interface AccountLookup {
  findById(id: string): Promise<AccountView | null>
}
