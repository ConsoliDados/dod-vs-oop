import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { InvalidEntityError } from '../../../core/errors'
import { AccountAggregate, type AccountSnapshot } from '../entities/account.aggregate'

/**
 * The validator runs inside the aggregate constructor, so it is exercised
 * through construction: an invalid account can never be built, and the thrown
 * `InvalidEntityError` carries the accumulated per-field errors.
 */
describe('AccountValidator', () => {
  function snapshot(overrides: Partial<AccountSnapshot> = {}): AccountSnapshot {
    return {
      id: randomUUID(),
      ownerId: 'owner-1',
      currency: 'BRL',
      status: 'active',
      availableBalanceCents: 0,
      holdAmountCents: 0,
      version: 0,
      lastPostedSeq: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }
  }

  it('throws InvalidEntityError carrying the offending field', () => {
    try {
      AccountAggregate.create('', 'BRL')
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidEntityError)
      const offending = (err as InvalidEntityError).errors.map((e) => e.attribute)
      expect(offending).toContain('ownerId')
    }
  })

  it('accumulates multiple field errors before throwing (Notification, then throw)', () => {
    try {
      AccountAggregate.buildExisting(snapshot({ ownerId: '', holdAmountCents: -100, version: -1 }))
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidEntityError)
      const offending = (err as InvalidEntityError).errors.map((e) => e.attribute)
      expect(offending).toEqual(expect.arrayContaining(['ownerId', 'holdAmount', 'version']))
      expect((err as InvalidEntityError).errors.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('rejects an unknown status', () => {
    expect(() =>
      AccountAggregate.buildExisting(
        snapshot({ status: 'archived' as unknown as AccountSnapshot['status'] }),
      ),
    ).toThrow(InvalidEntityError)
  })

  it('rejects a negative lastPostedSeq', () => {
    try {
      AccountAggregate.buildExisting(snapshot({ lastPostedSeq: -1 }))
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidEntityError)
      const offending = (err as InvalidEntityError).errors.map((e) => e.attribute)
      expect(offending).toContain('lastPostedSeq')
    }
  })

  it('rejects a non-integer lastPostedSeq', () => {
    expect(() => AccountAggregate.buildExisting(snapshot({ lastPostedSeq: 1.5 }))).toThrow(
      InvalidEntityError,
    )
  })

  it('rejects a whitespace-only ownerId on buildExisting (mirrors create())', () => {
    expect(() => AccountAggregate.buildExisting(snapshot({ ownerId: '   ' }))).toThrow(
      InvalidEntityError,
    )
  })

  it('rejects a non-integer version on buildExisting', () => {
    expect(() => AccountAggregate.buildExisting(snapshot({ version: 1.5 }))).toThrow(
      InvalidEntityError,
    )
  })
})
