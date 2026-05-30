import type { Currency, Money } from '../../../shared/value-objects'

/**
 * Cross-context read port — **accounts → ledger** (the reverse of FEAT-002's
 * `AccountLookup` ledger→accounts). Returns the account's balance summed
 * directly from the ledger's posting history (Σ signed `amountCents`) **and**
 * the highest posting `sequence` included in that sum (`throughSeq` per
 * ADR-0006). Used by `CloseAccountUseCase` (FEAT-007) and
 * `ConsolidateAccountBalanceUseCase` (FEAT-006).
 *
 * The widened contract returns both values from a single query so that
 * idempotency (FEAT-006 consolidation) can guard on `throughSeq` without
 * issuing a second read — and the close path stays a one-line destructure.
 *
 * The impl lives in `accounts/infrastructure/acl/` as an ACL reading the
 * ledger `postings` table read-only — the single place `accounts` infra
 * touches ledger persistence (ADR-0009 distribution seam).
 */
export interface LedgerBalanceReader {
  balanceAndThroughSeqOf(
    accountId: string,
    currency: Currency,
  ): Promise<{ balance: Money; throughSeq: number }>
}
