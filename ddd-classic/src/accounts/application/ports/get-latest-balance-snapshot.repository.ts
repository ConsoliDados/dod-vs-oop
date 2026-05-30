import type { BalanceSnapshot } from '../../domain/value-objects/balance-snapshot'

/**
 * Segregated read port (FEAT-006): returns the latest `BalanceSnapshot` for
 * an account by `throughSeq DESC`, or `null` when none has been consolidated
 * yet. The append-only ordering by `throughSeq` is monotonic, so "latest by
 * `throughSeq`" is the right notion of "current consolidated state" (not
 * `createdAt` — wall-clock drift wouldn't change the audit trail's order).
 *
 * Framework-agnostic; the TypeORM impl lives in `infrastructure/`.
 */
export interface GetLatestBalanceSnapshotRepository {
  findLatestByAccountId(accountId: string): Promise<BalanceSnapshot | null>
}
