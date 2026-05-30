import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Logger } from '../../../shared/application/logger'
import { type Currency, Money } from '../../../shared/value-objects'
import { AccountAggregate } from '../../domain/entities/account.aggregate'
import { OptimisticLockError } from '../errors/optimistic-lock.error'
import type { GetAccountRepository } from '../repositories/get-account.repository'
import type { UpdateAccountRepository } from '../repositories/update-account.repository'
import {
  OnTransactionPostedHandler,
  type PostedTransactionEntry,
  TRANSACTION_POSTED_EVENT_TYPE,
  type TransactionPostedNotification,
} from './on-transaction-posted.handler'

/**
 * Unit spec for `OnTransactionPostedHandler` — covers the **swallow-and-log**
 * branches end-to-end with mocked ports. The e2e
 * (`reflect-balance-desync.e2e.spec.ts`) covers the OptimisticLockError flow;
 * this spec covers the *other* failure modes that don't fire on a normal
 * desync test (absent account, currency mismatch from data corruption, empty
 * event, multi-account where one fails).
 *
 * Discipline asserted everywhere: the producer is **never** failed by a
 * handler-side exception — the method always resolves.
 */
describe('OnTransactionPostedHandler', () => {
  function makeEvent(entries: PostedTransactionEntry[]): TransactionPostedNotification {
    return {
      eventId: randomUUID(),
      eventType: TRANSACTION_POSTED_EVENT_TYPE,
      aggregateId: randomUUID(),
      occurredAt: new Date(),
      entries,
    }
  }

  function makeEntry(overrides: Partial<PostedTransactionEntry> = {}): PostedTransactionEntry {
    return {
      accountId: randomUUID(),
      amountCents: 1000,
      currency: 'BRL',
      sequence: 1,
      ...overrides,
    }
  }

  function makeLogger(): Logger & {
    calls(): Array<{ message: string; ctx?: Record<string, unknown> }>
  } {
    const warnCalls: Array<{ message: string; ctx?: Record<string, unknown> }> = []
    return {
      warn: (message: string, context?: Record<string, unknown>) => {
        warnCalls.push(context !== undefined ? { message, ctx: context } : { message })
      },
      error: () => {},
      info: () => {},
      calls() {
        return warnCalls
      },
    }
  }

  let getAccount: GetAccountRepository
  let updateAccount: UpdateAccountRepository

  beforeEach(() => {
    getAccount = { findById: vi.fn() }
    updateAccount = { update: vi.fn() }
  })

  it('happy path: folds the entry into the account and persists', async () => {
    const account = AccountAggregate.create('owner-1', 'BRL')
    const accountId = account.getId().getValue()
    ;(getAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account)
    ;(updateAccount.update as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    const logger = makeLogger()
    const handler = new OnTransactionPostedHandler(getAccount, updateAccount, logger)

    await handler.handle(makeEvent([makeEntry({ accountId, amountCents: 1000, sequence: 5 })]))

    expect(account.getAvailableBalance().getCents()).toBe(1000)
    expect(account.getLastPostedSeq()).toBe(5)
    expect(updateAccount.update).toHaveBeenCalledOnce()
    expect(logger.calls()).toEqual([])
  })

  it('swallow + log: account not found → logs warning, continues, never throws', async () => {
    ;(getAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const logger = makeLogger()
    const handler = new OnTransactionPostedHandler(getAccount, updateAccount, logger)
    const missingId = randomUUID()

    await expect(
      handler.handle(makeEvent([makeEntry({ accountId: missingId })])),
    ).resolves.toBeUndefined()

    expect(updateAccount.update).not.toHaveBeenCalled()
    const calls = logger.calls()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.message).toMatch(/account not found/)
    expect(calls[0]?.ctx?.accountId).toBe(missingId)
  })

  it('swallow + log: OptimisticLockError from update → logs warning, continues, never throws', async () => {
    const account = AccountAggregate.create('owner-1', 'BRL')
    const accountId = account.getId().getValue()
    ;(getAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account)
    ;(updateAccount.update as ReturnType<typeof vi.fn>).mockRejectedValue(
      new OptimisticLockError(accountId),
    )
    const logger = makeLogger()
    const handler = new OnTransactionPostedHandler(getAccount, updateAccount, logger)

    await expect(handler.handle(makeEvent([makeEntry({ accountId })]))).resolves.toBeUndefined()

    const calls = logger.calls()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.message).toMatch(/failed to fold posting/)
    expect(calls[0]?.ctx?.accountId).toBe(accountId)
    expect(String(calls[0]?.ctx?.cause)).toMatch(/Optimistic lock conflict/)
  })

  it('swallow + log: currency mismatch from corrupt event → logs warning, continues', async () => {
    // Account is BRL; the event carries a USD entry (data-corruption scenario
    // a production system might see if a producer was misconfigured). The
    // aggregate's reflectPosting throws InvalidEntityError; the handler must
    // swallow it like any other infra blip.
    const account = AccountAggregate.create('owner-1', 'BRL')
    const accountId = account.getId().getValue()
    ;(getAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account)
    ;(updateAccount.update as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    const logger = makeLogger()
    const handler = new OnTransactionPostedHandler(getAccount, updateAccount, logger)

    await expect(
      handler.handle(
        makeEvent([makeEntry({ accountId, currency: 'USD' as Currency, amountCents: 100 })]),
      ),
    ).resolves.toBeUndefined()

    expect(updateAccount.update).not.toHaveBeenCalled()
    const calls = logger.calls()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.message).toMatch(/failed to fold posting/)
  })

  it('empty entries → no-op (no logger calls, no repo calls)', async () => {
    const logger = makeLogger()
    const handler = new OnTransactionPostedHandler(getAccount, updateAccount, logger)

    await expect(handler.handle(makeEvent([]))).resolves.toBeUndefined()

    expect(getAccount.findById).not.toHaveBeenCalled()
    expect(updateAccount.update).not.toHaveBeenCalled()
    expect(logger.calls()).toEqual([])
  })

  it('multi-account: one fails, the other succeeds — failure does not break the rest', async () => {
    const good = AccountAggregate.create('owner-good', 'BRL')
    const goodId = good.getId().getValue()
    const missingId = randomUUID()
    ;(getAccount.findById as ReturnType<typeof vi.fn>).mockImplementation(async (id: string) =>
      id === goodId ? good : null,
    )
    ;(updateAccount.update as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    const logger = makeLogger()
    const handler = new OnTransactionPostedHandler(getAccount, updateAccount, logger)

    await handler.handle(
      makeEvent([
        makeEntry({ accountId: missingId, amountCents: 500, sequence: 1 }),
        makeEntry({ accountId: goodId, amountCents: 2500, sequence: 2 }),
      ]),
    )

    // Good account was processed.
    expect(good.getAvailableBalance().getCents()).toBe(2500)
    expect(good.getLastPostedSeq()).toBe(2)
    expect(updateAccount.update).toHaveBeenCalledOnce()
    // Missing account was logged.
    const calls = logger.calls()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.ctx?.accountId).toBe(missingId)
  })

  it('groups multiple entries for the same account into one update', async () => {
    // The handler nets entries by account: same account, multiple entries → one
    // reflectPosting call with the net delta, one update.
    const account = AccountAggregate.create('owner-1', 'BRL')
    const accountId = account.getId().getValue()
    ;(getAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account)
    ;(updateAccount.update as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    const logger = makeLogger()
    const handler = new OnTransactionPostedHandler(getAccount, updateAccount, logger)

    await handler.handle(
      makeEvent([
        makeEntry({ accountId, amountCents: 100, sequence: 1 }),
        makeEntry({ accountId, amountCents: -50, sequence: 2 }),
        makeEntry({ accountId, amountCents: 25, sequence: 3 }),
      ]),
    )

    // Net delta = 100 + (-50) + 25 = 75; checkpoint advances to max sequence = 3.
    expect(account.getAvailableBalance().getCents()).toBe(75)
    expect(account.getLastPostedSeq()).toBe(3)
    expect(getAccount.findById).toHaveBeenCalledOnce()
    expect(updateAccount.update).toHaveBeenCalledOnce()
  })

  it('uses the Money.fromCents currency from the first entry per account', async () => {
    // The handler builds Money from the first entry's currency — that's enough
    // because all entries for the same account share a currency (REQ-006
    // single-currency invariant on the producer side). This documents the
    // assumption.
    const account = AccountAggregate.create('owner-1', 'BRL')
    const accountId = account.getId().getValue()
    ;(getAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account)
    ;(updateAccount.update as ReturnType<typeof vi.fn>).mockImplementation(async (acc) => {
      expect(acc.getAvailableBalance().getCurrency()).toBe('BRL')
    })
    const logger = makeLogger()
    const handler = new OnTransactionPostedHandler(getAccount, updateAccount, logger)

    await handler.handle(makeEvent([makeEntry({ accountId, amountCents: 100, sequence: 1 })]))

    expect(updateAccount.update).toHaveBeenCalledOnce()
  })

  it('reuses Money cleanly — does not double-apply or drift on retries (in-aggregate behavior)', async () => {
    // Sanity: the handler mutates the in-memory aggregate via reflectPosting.
    // If it were called twice for the same event (shouldn't happen on the bus,
    // but if it does), the second call throws "throughSeq must advance" — and
    // the handler catches that as a swallow-and-log too.
    const account = AccountAggregate.create('owner-1', 'BRL')
    const accountId = account.getId().getValue()
    ;(getAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account)
    ;(updateAccount.update as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    const logger = makeLogger()
    const handler = new OnTransactionPostedHandler(getAccount, updateAccount, logger)

    const event = makeEvent([makeEntry({ accountId, amountCents: 100, sequence: 5 })])
    await handler.handle(event)
    expect(account.getLastPostedSeq()).toBe(5)

    // Replay with the same sequence — reflectPosting rejects non-monotonic,
    // handler swallows.
    await handler.handle(event)
    expect(account.getLastPostedSeq()).toBe(5) // unchanged
    expect(logger.calls().length).toBe(1) // the second call was logged
  })

  // Marker — keep an explicit reference to the silenced Money import-only.
  it('exposes the event-type constant for the bus registration', () => {
    expect(TRANSACTION_POSTED_EVENT_TYPE).toBe('TransactionPosted')
    // Money used for an extra structural sanity (currency stays a string union)
    expect(Money.zero('BRL').getCurrency()).toBe('BRL')
  })
})
