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
})
