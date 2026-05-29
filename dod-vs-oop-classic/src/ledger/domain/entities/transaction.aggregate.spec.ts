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

  describe('reverseOf (FEAT-004)', () => {
    it('mirrors each posting (sign flipped) — debit↔credit per posting', () => {
      const original = TransactionAggregate.create({
        reference: 'INV-1',
        postings: [posting('debit', 1000), posting('credit', 1000)],
      })

      const reversal = TransactionAggregate.reverseOf(original)

      // Same accounts, same currency, postings count preserved.
      expect(reversal.getPostings()).toHaveLength(original.getPostings().length)
      expect(reversal.getCurrency()).toBe(original.getCurrency())

      // Per posting: sign flipped.
      for (let i = 0; i < original.getPostings().length; i++) {
        const op = original.getPostings()[i]
        const rp = reversal.getPostings()[i]
        if (!op || !rp) throw new Error('unreachable')
        expect(rp.getSignedCents()).toBe(-op.getSignedCents())
        expect(rp.getAccountId().getValue()).toBe(op.getAccountId().getValue())
      }
      // Net sum still zero (mirror of a zero-sum set is zero-sum).
      const sum = reversal.getPostings().reduce((acc, p) => acc + p.getSignedCents(), 0)
      expect(sum).toBe(0)
    })

    it('carries reversedTransactionId = original.id (one-way link, ADR-0011)', () => {
      const original = TransactionAggregate.create({
        postings: [posting('debit', 500), posting('credit', 500)],
      })

      const reversal = TransactionAggregate.reverseOf(original)

      expect(reversal.getReversedTransactionId()).toBe(original.getId().getValue())
      // Original is untouched — no reversedBy field, no link, original id unchanged.
      expect(original.getReversedTransactionId()).toBeUndefined()
    })

    it('uses a fresh aggregate id and fresh posting ids (original never reused)', () => {
      const original = TransactionAggregate.create({
        postings: [posting('debit', 500), posting('credit', 500)],
      })

      const reversal = TransactionAggregate.reverseOf(original)

      expect(reversal.getId().getValue()).not.toBe(original.getId().getValue())
      const originalPostingIds = new Set(original.getPostings().map((p) => p.getId().getValue()))
      for (const rp of reversal.getPostings()) {
        expect(originalPostingIds.has(rp.getId().getValue())).toBe(false)
      }
    })

    it('prefixes the original reference when present, leaves undefined otherwise', () => {
      const withRef = TransactionAggregate.reverseOf(
        TransactionAggregate.create({
          reference: 'INV-1',
          postings: [posting('debit', 500), posting('credit', 500)],
        }),
      )
      expect(withRef.getReference()).toBe('Reversal of INV-1')

      const withoutRef = TransactionAggregate.reverseOf(
        TransactionAggregate.create({
          postings: [posting('debit', 500), posting('credit', 500)],
        }),
      )
      expect(withoutRef.getReference()).toBeUndefined()
    })

    it('allows reverse-of-a-reversal (chain depth not capped — gate 2026-05-29)', () => {
      const original = TransactionAggregate.create({
        postings: [posting('debit', 1000), posting('credit', 1000)],
      })

      const reversal = TransactionAggregate.reverseOf(original)
      const reReversal = TransactionAggregate.reverseOf(reversal)

      // Re-reversal is a re-do of the original (sign flipped twice = same sign).
      for (let i = 0; i < original.getPostings().length; i++) {
        const op = original.getPostings()[i]
        const rrp = reReversal.getPostings()[i]
        if (!op || !rrp) throw new Error('unreachable')
        expect(rrp.getSignedCents()).toBe(op.getSignedCents())
      }
      expect(reReversal.getReversedTransactionId()).toBe(reversal.getId().getValue())
    })

    it('mirrors a 3-posting unbalanced-looking shape (still balanced after mirror)', () => {
      const original = TransactionAggregate.create({
        postings: [posting('debit', 600), posting('debit', 400), posting('credit', 1000)],
      })

      const reversal = TransactionAggregate.reverseOf(original)

      // (600 debit, 400 debit, 1000 credit) → (600 credit, 400 credit, 1000 debit). Sum zero.
      const sum = reversal.getPostings().reduce((acc, p) => acc + p.getSignedCents(), 0)
      expect(sum).toBe(0)
      const signs = reversal.getPostings().map((p) => Math.sign(p.getSignedCents()))
      const originalSigns = original.getPostings().map((p) => Math.sign(p.getSignedCents()))
      expect(signs).toEqual(originalSigns.map((s) => -s))
    })
  })
})
