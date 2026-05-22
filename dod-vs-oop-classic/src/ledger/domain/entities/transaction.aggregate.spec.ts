import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { InvalidEntityError } from '../../../core/errors'
import type { Currency } from '../../../shared/value-objects'
import { TransactionPostedEvent } from '../events/transaction-posted.event'
import { type PostingInput, TransactionAggregate } from './transaction.aggregate'

function posting(
  direction: 'debit' | 'credit',
  amountCents = 1000,
  currency: Currency = 'BRL',
): PostingInput {
  return { accountId: randomUUID(), amountCents, direction, currency }
}

describe('TransactionAggregate', () => {
  it('creates a balanced transaction and emits TransactionPosted', () => {
    const tx = TransactionAggregate.create({ postings: [posting('debit'), posting('credit')] })

    expect(tx.getPostings()).toHaveLength(2)
    expect(tx.getCurrency()).toBe('BRL')

    const events = tx.getDomainEvents()
    expect(events).toHaveLength(1)
    expect(events[0]).toBeInstanceOf(TransactionPostedEvent)
    const entries = (events[0] as TransactionPostedEvent).entries
    expect(entries).toHaveLength(2)
    // signed: debit −1000, credit +1000 → sums to zero
    expect(entries.reduce((acc, e) => acc + e.amountCents, 0)).toBe(0)
  })

  it('THROWS InvalidEntityError on an unbalanced transaction', () => {
    expect(() =>
      TransactionAggregate.create({ postings: [posting('debit', 1000), posting('credit', 500)] }),
    ).toThrow(InvalidEntityError)
  })

  it('THROWS InvalidEntityError on fewer than 2 postings', () => {
    expect(() => TransactionAggregate.create({ postings: [posting('credit')] })).toThrow(
      InvalidEntityError,
    )
  })

  it('THROWS InvalidEntityError on mixed currencies', () => {
    expect(() =>
      TransactionAggregate.create({
        postings: [posting('debit', 1000, 'BRL'), posting('credit', 1000, 'USD')],
      }),
    ).toThrow(InvalidEntityError)
  })

  it('round-trips a multi-posting transaction (2 debits + 1 credit, balanced)', () => {
    const tx = TransactionAggregate.create({
      reference: 'INV-1',
      postings: [posting('debit', 600), posting('debit', 400), posting('credit', 1000)],
    })
    expect(tx.getPostings()).toHaveLength(3)
    expect(tx.getReference()).toBe('INV-1')
  })
})
