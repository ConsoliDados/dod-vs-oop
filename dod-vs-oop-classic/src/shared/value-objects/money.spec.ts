import { describe, expect, it } from 'vitest'
import { InvalidValueObjectError } from '../../core/errors'
import { type Currency, Money } from './money'

/**
 * Smoke tests for Money (currency-aware VO with multi-error Validator).
 *
 * Validates:
 * - Valid input returns a fresh instance.
 * - Invalid amount (NaN, Infinity) throws `InvalidValueObjectError`.
 * - The Validator accumulates multiple errors (Notification Pattern internally)
 *   before throwing the aggregated `InvalidValueObjectError`.
 * - Arithmetic preserves currency; mismatched currency throws.
 */
describe('Money (VO + Validator with multiple errors)', () => {
  it('creates valid Money', () => {
    const m = Money.create(100.5, 'BRL')
    expect(m.getAmount()).toBe(100.5)
    expect(m.getCurrency()).toBe('BRL')
  })

  it('THROWS InvalidValueObjectError on NaN amount', () => {
    expect(() => Money.create(Number.NaN, 'BRL')).toThrow(InvalidValueObjectError)
  })

  it('THROWS InvalidValueObjectError on infinite amount', () => {
    expect(() => Money.create(Number.POSITIVE_INFINITY, 'BRL')).toThrow(InvalidValueObjectError)
  })

  it('THROWS InvalidValueObjectError aggregating multiple errors', () => {
    try {
      Money.create(Number.NaN, 'XYZ' as unknown as Currency)
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidValueObjectError)
      const e = err as InvalidValueObjectError
      // NaN + invalid currency = multiple errors aggregated
      expect(e.errors.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('arithmetic preserves currency', () => {
    const a = Money.create(10, 'USD')
    const b = Money.create(5, 'USD')
    expect(a.add(b).getAmount()).toBe(15)
    expect(a.subtract(b).getAmount()).toBe(5)
  })

  it('THROWS on currency mismatch in arithmetic', () => {
    const a = Money.create(10, 'USD')
    const b = Money.create(5, 'BRL')
    expect(() => a.add(b)).toThrow(/different currencies/)
  })
})
