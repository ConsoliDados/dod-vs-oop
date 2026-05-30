import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { InvalidEntityError } from '../../../core/errors'
import { Identifier, Money } from '../../../shared/value-objects'
import { Posting } from './posting.entity'

describe('Posting', () => {
  it('creates a signed posting and derives its direction', () => {
    const debit = Posting.create(
      Identifier.buildExisting(randomUUID()),
      Money.fromCents(-1000, 'BRL'),
      new Date(),
    )
    expect(debit.getSignedCents()).toBe(-1000)
    expect(debit.getDirection()).toBe('debit')

    const credit = Posting.create(
      Identifier.buildExisting(randomUUID()),
      Money.fromCents(1000, 'BRL'),
      new Date(),
    )
    expect(credit.getDirection()).toBe('credit')
    expect(credit.getSequence()).toBeUndefined()
  })

  it('THROWS InvalidEntityError on a zero amount', () => {
    expect(() =>
      Posting.create(Identifier.buildExisting(randomUUID()), Money.fromCents(0, 'BRL'), new Date()),
    ).toThrow(InvalidEntityError)
  })

  it('buildExisting round-trips with its persisted sequence', () => {
    const id = randomUUID()
    const accountId = randomUUID()
    const now = new Date()
    const posting = Posting.buildExisting({
      id,
      accountId,
      amountCents: -500,
      currency: 'USD',
      postedAt: now,
      sequence: 42,
      createdAt: now,
      updatedAt: now,
    })
    expect(posting.getId().getValue()).toBe(id)
    expect(posting.getAccountId().getValue()).toBe(accountId)
    expect(posting.getSignedCents()).toBe(-500)
    expect(posting.getDirection()).toBe('debit')
    expect(posting.getSequence()).toBe(42)
  })
})
