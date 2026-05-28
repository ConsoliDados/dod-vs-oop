import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { InvalidEntityError } from '../../../core/errors'
import type { Currency } from '../../../shared/value-objects'
import { type PostingInput, TransactionAggregate } from './transaction.aggregate'

function posting(
  direction: 'debit' | 'credit',
  amountCents = 1000,
  currency: Currency = 'BRL',
): PostingInput {
  return { accountId: randomUUID(), amountCents, direction, currency }
}

describe('TransactionAggregate', () => {
  it('creates a balanced transaction (signed amounts sum to zero)', () => {
    const tx = TransactionAggregate.create({ postings: [posting('debit'), posting('credit')] })

    expect(tx.getPostings()).toHaveLength(2)
    expect(tx.getCurrency()).toBe('BRL')
    // signed: debit −1000, credit +1000 → sums to zero
    const sum = tx.getPostings().reduce((acc, p) => acc + p.getSignedCents(), 0)
    expect(sum).toBe(0)
    // `TransactionPosted` is built by the use case post-persistence (ADR-0008), not
    // on create — covered by post-transaction.e2e + reflect-balance.e2e.
    expect(tx.getDomainEvents()).toHaveLength(0)
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
