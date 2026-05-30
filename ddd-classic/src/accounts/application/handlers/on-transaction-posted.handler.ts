import type { DomainEvent } from '../../../core/events/domain-event'
import type { EventHandler } from '../../../shared/application/event-bus'
import type { Logger } from '../../../shared/application/logger'
import { type Currency, Money } from '../../../shared/value-objects'
import type { GetAccountRepository } from '../repositories/get-account.repository'
import type { UpdateAccountRepository } from '../repositories/update-account.repository'

/** Event-type string published by `ledger` on a posted transaction (its `EVENT_TYPE`). */
export const TRANSACTION_POSTED_EVENT_TYPE = 'TransactionPosted'

/** Plain-data effect of one posting on one account (the `ledger` contract; ADR-0008). */
export interface PostedTransactionEntry {
  accountId: string
  amountCents: number
  currency: Currency
  sequence: number
}

/**
 * Inbound shape of `TransactionPosted` as consumed here — the plain-data payload
 * that crosses the bus (SAD §4). Declared locally so `accounts` never imports
 * `ledger/domain` (symmetric to the `AccountLookup` ACL on the ledger side).
 */
export interface TransactionPostedNotification extends DomainEvent {
  readonly entries: PostedTransactionEntry[]
}

/**
 * Folds a posted transaction into the affected accounts' cached balances
 * (REQ-003 cross-context; ADR-0006). Reacts to `TransactionPosted` on the
 * synchronous in-memory bus (ADR-0003) — no Outbox, no retry. Framework-free
 * (ADR-0005); the infra provider registers it with the bus.
 *
 * Per event: group entries by account, apply the net signed delta, advance the
 * checkpoint to the highest posting `sequence` folded in for that account.
 *
 * **Swallow-and-log refinement (ADR-0003, recomputable-cache path).** Each
 * account is processed in its own try/catch. A failure (account missing,
 * `OptimisticLockError`, infra blip) is **logged as a warning** with the
 * `accountId` + `cause` and the handler **continues with the next account** —
 * it never rethrows to the producer. This amends ADR-0003's blanket "handler
 * errors propagate" only for the cross-context cache update: the cached
 * `availableBalance` is recomputable (NFR-DATA-001), the immutable
 * `BalanceSnapshot` trail is untouched by this path (ADR-0006), and failing
 * `POST /transactions` (HTTP 500) for a downstream cache hiccup would silently
 * lose the *posting* — far worse than a transient desync. A real production
 * deployment would back this with a retry queue / Outbox; in the foil the
 * desync is recoverable by recompute (FEAT-006 `ConsolidateAccountBalance`).
 */
export class OnTransactionPostedHandler implements EventHandler<TransactionPostedNotification> {
  constructor(
    private readonly getAccount: GetAccountRepository,
    private readonly updateAccount: UpdateAccountRepository,
    private readonly logger: Logger,
  ) {}

  async handle(event: TransactionPostedNotification): Promise<void> {
    const byAccount = new Map<string, PostedTransactionEntry[]>()
    for (const entry of event.entries) {
      const list = byAccount.get(entry.accountId) ?? []
      list.push(entry)
      byAccount.set(entry.accountId, list)
    }

    for (const [accountId, entries] of byAccount) {
      const first = entries[0]
      if (!first) continue // unreachable: a key exists only with ≥1 entry

      try {
        const account = await this.getAccount.findById(accountId)
        if (!account) {
          this.logger.warn(
            'reflect-balance: account not found; cache desynced (recoverable by recompute)',
            {
              accountId,
              transactionId: event.aggregateId,
            },
          )
          continue
        }

        const netCents = entries.reduce((sum, e) => sum + e.amountCents, 0)
        const throughSeq = entries.reduce((max, e) => Math.max(max, e.sequence), 0)
        account.reflectPosting(Money.fromCents(netCents, first.currency), throughSeq)
        await this.updateAccount.update(account)
      } catch (cause) {
        this.logger.warn(
          'reflect-balance: failed to fold posting; cache desynced (recoverable by recompute)',
          {
            accountId,
            transactionId: event.aggregateId,
            cause: cause instanceof Error ? cause.message : String(cause),
          },
        )
      }
    }
  }
}
