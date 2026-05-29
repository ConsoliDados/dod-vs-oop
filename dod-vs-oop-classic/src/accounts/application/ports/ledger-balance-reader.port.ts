import type { Currency, Money } from '../../../shared/value-objects'

/**
 * Cross-context read port — **accounts → ledger** (the reverse of FEAT-002's
 * `AccountLookup` ledger→accounts). Returns the account's balance summed
 * directly from the ledger's posting history (Σ signed `amountCents`) as
 * `Money` in the requested `currency`. Used by `CloseAccountUseCase` /
 * `CloseAccountService` so that closing is gated by a balance recomputed from
 * the source of truth, not the cache (NFR-DATA-001, ADR-0006, ADR-0010).
 *
 * The impl lives in `accounts/infrastructure/acl/` as an ACL reading the
 * ledger `postings` table read-only — the single place `accounts` infra
 * touches ledger persistence (ADR-0009 distribution seam).
 */
export interface LedgerBalanceReader {
  balanceOf(accountId: string, currency: Currency): Promise<Money>
}
