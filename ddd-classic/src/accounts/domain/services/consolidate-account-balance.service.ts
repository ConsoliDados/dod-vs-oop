import type { DomainService } from '../../../core/services/domain-service'
import type { Currency, Money } from '../../../shared/value-objects'
import { BalanceSnapshot } from '../value-objects/balance-snapshot'

/**
 * `ConsolidateAccountBalance` — the study's **second** cross-aggregate domain
 * service (after `CloseAccountService`; FEAT-006, ADR-0006).
 *
 * Encodes the rule "appending the snapshot trail is monotonic in
 * `throughSeq`" (NFR-DATA-001 audit trail). Given the ledger-recomputed
 * `{ balance, throughSeq }` and the prior latest snapshot (or none), it
 * decides whether a new snapshot is warranted:
 *
 * - First-ever consolidation (no `latest`) → **append** a snapshot with the
 *   current `{ balance, throughSeq }`. Honest zero (`throughSeq = 0`,
 *   `balance = 0`) is a valid first snapshot.
 * - `throughSeq > latest.throughSeq` → **append** a new snapshot; the trail
 *   advances strictly.
 * - `throughSeq ≤ latest.throughSeq` → **no-op**; return the prior snapshot
 *   unchanged. Friendly to retries (gate decision 2026-05-29).
 *
 * **Pure — no I/O.** The use case reads the ledger sum via the
 * `LedgerBalanceReader` ACL and the latest snapshot via the repo, then
 * passes both in. Keeps the service trivially unit-testable.
 *
 * Idempotency is enforced at this layer, not the database — a unique
 * constraint on `(accountId, throughSeq)` would turn a race into a 500;
 * the service rule reads as no-op instead. The cache is **not** touched
 * here — it's `OnTransactionPostedHandler`'s responsibility (ADR-0006:
 * "the cache overwrites, the snapshot appends").
 */
export class ConsolidateAccountBalance implements DomainService {
  consolidate(input: {
    accountId: string
    currency: Currency
    ledger: { balance: Money; throughSeq: number }
    latest: BalanceSnapshot | undefined
    now: Date
  }): {
    /** Set when a new snapshot must be persisted. Undefined on a no-op. */
    appended: BalanceSnapshot | undefined
    /** Always the snapshot that represents the current consolidated state. */
    current: BalanceSnapshot
  } {
    const { accountId, ledger, latest, now } = input
    if (latest && ledger.throughSeq <= latest.getThroughSeq()) {
      return { appended: undefined, current: latest }
    }
    const appended = BalanceSnapshot.create({
      accountId,
      asOf: now,
      balance: ledger.balance,
      throughSeq: ledger.throughSeq,
    })
    return { appended, current: appended }
  }
}
