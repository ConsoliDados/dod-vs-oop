import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { InvalidValueObjectError } from '../../../core/errors'
import { Money } from '../../../shared/value-objects'
import { BalanceSnapshot, type BalanceSnapshotValue } from './balance-snapshot'

function valid(overrides: Partial<BalanceSnapshotValue> = {}): BalanceSnapshotValue {
  return {
    accountId: randomUUID(),
    asOf: new Date('2026-01-01T00:00:00.000Z'),
    balance: Money.fromCents(1500, 'BRL'),
    throughSeq: 42,
    ...overrides,
  }
}

describe('BalanceSnapshot', () => {
  it('creates a valid snapshot and exposes its parts', () => {
    const value = valid()
    const snapshot = BalanceSnapshot.create(value)

    expect(snapshot.getAccountId()).toBe(value.accountId)
    expect(snapshot.getAsOf()).toEqual(value.asOf)
    expect(snapshot.getBalance().isEqual(Money.fromCents(1500, 'BRL'))).toBe(true)
    expect(snapshot.getThroughSeq()).toBe(42)
  })

  it('allows a zero checkpoint (nothing folded yet)', () => {
    expect(() => BalanceSnapshot.create(valid({ throughSeq: 0 }))).not.toThrow()
  })

  it('THROWS InvalidValueObjectError on a negative throughSeq', () => {
    expect(() => BalanceSnapshot.create(valid({ throughSeq: -1 }))).toThrow(InvalidValueObjectError)
  })

  it('THROWS InvalidValueObjectError on a non-integer throughSeq', () => {
    expect(() => BalanceSnapshot.create(valid({ throughSeq: 1.5 }))).toThrow(
      InvalidValueObjectError,
    )
  })

  it('THROWS InvalidValueObjectError on an empty accountId', () => {
    expect(() => BalanceSnapshot.create(valid({ accountId: '  ' }))).toThrow(
      InvalidValueObjectError,
    )
  })

  it('is equal to another snapshot with the same parts', () => {
    const value = valid()
    expect(BalanceSnapshot.create(value).isEqual(BalanceSnapshot.create(value))).toBe(true)
  })
})
