import type { BalanceSnapshot } from '../../domain/value-objects/balance-snapshot'

/**
 * Segregated **append-only** port for `BalanceSnapshot` (FEAT-006, ADR-0006).
 * The snapshot trail is the retained audit record — *the cache overwrites,
 * the snapshot appends*. There is no update / delete path by design.
 *
 * Idempotency is the responsibility of `ConsolidateAccountBalance`; this
 * repo trusts its input and writes unconditionally. Framework-agnostic.
 */
export interface AppendBalanceSnapshotRepository {
  append(snapshot: BalanceSnapshot): Promise<void>
}
