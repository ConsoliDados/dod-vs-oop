import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { InvalidEntityError } from '../../../core/errors'
import { TransactionAggregate } from '../entities/transaction.aggregate'

/**
 * The validator runs inside the aggregate constructor, so it is exercised
 * through `create`: an invalid transaction can never be built, and the thrown
 * `InvalidEntityError` carries the offending field.
 */
describe('TransactionValidator', () => {
  it('reports the `postings` field on an unbalanced transaction', () => {
    try {
      TransactionAggregate.create({
        postings: [
          { accountId: randomUUID(), amountCents: 1000, direction: 'debit', currency: 'BRL' },
          { accountId: randomUUID(), amountCents: 700, direction: 'credit', currency: 'BRL' },
        ],
      })
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidEntityError)
      expect((err as InvalidEntityError).errors.map((e) => e.attribute)).toContain('postings')
    }
  })

  describe('reversedTransactionId guard (FEAT-004)', () => {
    function validPostings() {
      return [
        {
          accountId: randomUUID(),
          amountCents: 1000,
          direction: 'debit' as const,
          currency: 'BRL' as const,
        },
        {
          accountId: randomUUID(),
          amountCents: 1000,
          direction: 'credit' as const,
          currency: 'BRL' as const,
        },
      ]
    }

    it('accepts a fresh tx without a reversedTransactionId (undefined)', () => {
      const tx = TransactionAggregate.create({ postings: validPostings() })
      expect(tx.getReversedTransactionId()).toBeUndefined()
    })

    it('THROWS InvalidEntityError on buildExisting with a non-36-char reversedTransactionId', () => {
      // Simulate a corrupt persisted snapshot: a uuid-shaped string that is the
      // wrong length. buildExisting re-runs the validator so the round-trip
      // catches it before the use case sees the aggregate.
      const fresh = TransactionAggregate.create({ postings: validPostings() })
      const snapshot = {
        id: fresh.getId().getValue(),
        reference: fresh.getReference(),
        metadata: fresh.getMetadata(),
        postedAt: fresh.getPostedAt(),
        reversedTransactionId: 'not-a-uuid',
        postings: fresh.getPostings().map((p) => ({
          id: p.getId().getValue(),
          accountId: p.getAccountId().getValue(),
          amountCents: p.getSignedCents(),
          currency: p.getAmount().getCurrency(),
          postedAt: p.getPostedAt(),
          sequence: 1,
          createdAt: p.getCreatedAt(),
          updatedAt: p.getUpdatedAt(),
        })),
        createdAt: fresh.getCreatedAt(),
        updatedAt: fresh.getUpdatedAt(),
      }

      try {
        TransactionAggregate.buildExisting(snapshot)
        expect.fail('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidEntityError)
        const offending = (err as InvalidEntityError).errors.map((e) => e.attribute)
        expect(offending).toContain('reversedTransactionId')
      }
    })
  })
})
