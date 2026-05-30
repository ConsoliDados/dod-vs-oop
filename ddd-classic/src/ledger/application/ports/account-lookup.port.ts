import type { Currency } from '../../../shared/value-objects'

/**
 * Local mirror of `accounts/domain/account-status.AccountStatus` — kept here
 * (not imported) so `ledger` never depends on `accounts/domain` (SAD §4
 * cross-context payload pattern; symmetric to `accounts`' local declaration
 * of `TransactionPosted`'s shape). Drift between this and `accounts`' status
 * union is caught by the e2e specs.
 */
export type AccountLookupStatus = 'active' | 'frozen' | 'closed'

/** Minimal, ledger-local view of an account (anti-corruption — no `accounts/domain` import). */
export interface AccountView {
  id: string
  currency: Currency
  status: AccountLookupStatus
}

/**
 * Cross-context read port: the `ledger` needs an account's currency, status,
 * and existence to post against it, but must not import `accounts/domain`
 * (SAD §4). Implemented as an ACL in `ledger/infrastructure`, returning the
 * local {@link AccountView} (or `null` when the account is absent /
 * soft-deleted). `PostTransactionUseCase` uses `status` to reject (422) a
 * posting to a non-`active` account (REQ-006, FEAT-007 / ADR-0010).
 */
export interface AccountLookup {
  findById(id: string): Promise<AccountView | null>
}
