import { describe, expect, it } from 'vitest'
import { Money } from '../../../shared/value-objects'
import { BalanceSnapshot } from '../value-objects/balance-snapshot'
import { ConsolidateAccountBalance } from './consolidate-account-balance.service'

describe('ConsolidateAccountBalance', () => {
  const service = new ConsolidateAccountBalance()
  const accountId = 'a1b2c3d4-e5f6-7890-1234-567890abcdef'

  it('appends a first snapshot when none exists (even at throughSeq=0, honest zero)', () => {
    const result = service.consolidate({
      accountId,
      currency: 'BRL',
      ledger: { balance: Money.zero('BRL'), throughSeq: 0 },
      latest: undefined,
      now: new Date('2026-05-29T12:00:00.000Z'),
    })
    expect(result.appended).toBeDefined()
    expect(result.appended?.getAccountId()).toBe(accountId)
    expect(result.appended?.getThroughSeq()).toBe(0)
    expect(result.appended?.getBalance().getCents()).toBe(0)
    expect(result.current).toBe(result.appended)
  })

  it('appends a new snapshot when throughSeq advances beyond the latest', () => {
    const latest = BalanceSnapshot.create({
      accountId,
      asOf: new Date('2026-05-29T10:00:00.000Z'),
      balance: Money.fromCents(1000, 'BRL'),
      throughSeq: 5,
    })
    const result = service.consolidate({
      accountId,
      currency: 'BRL',
      ledger: { balance: Money.fromCents(1500, 'BRL'), throughSeq: 7 },
      latest,
      now: new Date('2026-05-29T12:00:00.000Z'),
    })
    expect(result.appended).toBeDefined()
    expect(result.appended?.getThroughSeq()).toBe(7)
    expect(result.appended?.getBalance().getCents()).toBe(1500)
    expect(result.current).toBe(result.appended)
  })

  it('is a NO-OP when throughSeq equals the latest (idempotent retry)', () => {
    const latest = BalanceSnapshot.create({
      accountId,
      asOf: new Date('2026-05-29T10:00:00.000Z'),
      balance: Money.fromCents(1000, 'BRL'),
      throughSeq: 5,
    })
    const result = service.consolidate({
      accountId,
      currency: 'BRL',
      ledger: { balance: Money.fromCents(1000, 'BRL'), throughSeq: 5 },
      latest,
      now: new Date('2026-05-29T12:00:00.000Z'),
    })
    expect(result.appended).toBeUndefined()
    expect(result.current).toBe(latest)
  })

  it('is a NO-OP when throughSeq is below the latest (defensive — should not happen)', () => {
    const latest = BalanceSnapshot.create({
      accountId,
      asOf: new Date('2026-05-29T10:00:00.000Z'),
      balance: Money.fromCents(2000, 'BRL'),
      throughSeq: 10,
    })
    const result = service.consolidate({
      accountId,
      currency: 'BRL',
      ledger: { balance: Money.fromCents(1500, 'BRL'), throughSeq: 7 },
      latest,
      now: new Date('2026-05-29T12:00:00.000Z'),
    })
    expect(result.appended).toBeUndefined()
    expect(result.current).toBe(latest)
  })

  it('snapshot reflects the LEDGER balance, not any cache (NFR-DATA-001)', () => {
    // The service only ever sees the ledger sum. There is no cache input it
    // could blend with, so the snapshot's balance is structurally the
    // ledger's. Asserted here so a future refactor doesn't accidentally pull
    // in a cache argument.
    const result = service.consolidate({
      accountId,
      currency: 'BRL',
      ledger: { balance: Money.fromCents(-300, 'BRL'), throughSeq: 12 },
      latest: undefined,
      now: new Date(),
    })
    expect(result.appended?.getBalance().getCents()).toBe(-300)
  })
})
