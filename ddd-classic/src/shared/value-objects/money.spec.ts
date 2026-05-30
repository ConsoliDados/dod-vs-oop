import { describe, expect, it } from 'vitest'
import { InvalidValueObjectError } from '../../core/errors'
import { type Currency, Money } from './money'

/**
 * Unit tests for Money (integer-minor-units VO, ADR-0004 / SRS §6).
 *
 * Covers:
 * - `fromCents` stores exact integer cents; rejects non-integer / NaN / Infinity.
 * - `fromDecimal` rounds half-even at the boundary.
 * - add/subtract are exact; multiply/divide round half-even.
 * - The Validator accumulates multiple errors before throwing the aggregated
 *   `InvalidValueObjectError`.
 * - Arithmetic preserves currency; a mismatch throws.
 */
describe('Money (integer minor units)', () => {
  it('fromCents stores exact integer cents', () => {
    const m = Money.fromCents(10050, 'BRL')
    expect(m.getCents()).toBe(10050)
    expect(m.getCurrency()).toBe('BRL')
  })

  it('THROWS InvalidValueObjectError on a non-integer cents amount', () => {
    expect(() => Money.fromCents(100.5, 'BRL')).toThrow(InvalidValueObjectError)
  })

  it('THROWS InvalidValueObjectError on NaN cents', () => {
    expect(() => Money.fromCents(Number.NaN, 'BRL')).toThrow(InvalidValueObjectError)
  })

  it('THROWS InvalidValueObjectError on infinite cents', () => {
    expect(() => Money.fromCents(Number.POSITIVE_INFINITY, 'BRL')).toThrow(InvalidValueObjectError)
  })

  it('THROWS InvalidValueObjectError aggregating multiple errors', () => {
    try {
      Money.fromCents(Number.NaN, 'XYZ' as unknown as Currency)
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidValueObjectError)
      const e = err as InvalidValueObjectError
      expect(e.errors.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('zero builds a zero-cents instance', () => {
    expect(Money.zero('USD').getCents()).toBe(0)
    expect(Money.zero('USD').isZero()).toBe(true)
  })

  describe('fromDecimal (boundary, half-even)', () => {
    it('converts a 2-dp decimal to exact cents', () => {
      expect(Money.fromDecimal(100.5, 'BRL').getCents()).toBe(10050)
      expect(Money.fromDecimal(0.01, 'BRL').getCents()).toBe(1)
    })

    it('rounds half-even for a 0-dp currency (JPY)', () => {
      expect(Money.fromDecimal(100.4, 'JPY').getCents()).toBe(100)
      expect(Money.fromDecimal(100.6, 'JPY').getCents()).toBe(101)
      // .5 ties round to even
      expect(Money.fromDecimal(100.5, 'JPY').getCents()).toBe(100)
      expect(Money.fromDecimal(101.5, 'JPY').getCents()).toBe(102)
    })
  })

  describe('arithmetic', () => {
    it('add/subtract are exact integer operations', () => {
      const a = Money.fromCents(1000, 'USD')
      const b = Money.fromCents(500, 'USD')
      expect(a.add(b).getCents()).toBe(1500)
      expect(a.subtract(b).getCents()).toBe(500)
    })

    it('multiply rounds half-even', () => {
      expect(Money.fromCents(101, 'BRL').multiply(0.5).getCents()).toBe(50) // 50.5 → 50 (even)
      expect(Money.fromCents(103, 'BRL').multiply(0.5).getCents()).toBe(52) // 51.5 → 52 (even)
    })

    it('divide rounds half-even', () => {
      expect(Money.fromCents(101, 'BRL').divide(2).getCents()).toBe(50) // 50.5 → 50 (even)
      expect(Money.fromCents(103, 'BRL').divide(2).getCents()).toBe(52) // 51.5 → 52 (even)
    })

    it('THROWS dividing by zero', () => {
      expect(() => Money.fromCents(100, 'BRL').divide(0)).toThrow(/divide money by zero/)
    })

    it('THROWS on a currency mismatch (add)', () => {
      const a = Money.fromCents(1000, 'USD')
      const b = Money.fromCents(500, 'BRL')
      expect(() => a.add(b)).toThrow(/different currencies/)
    })

    it('THROWS on a currency mismatch (subtract / compareTo / isGreaterThan / isLessThan)', () => {
      const a = Money.fromCents(1000, 'USD')
      const b = Money.fromCents(500, 'BRL')
      expect(() => a.subtract(b)).toThrow(/different currencies/)
      expect(() => a.compareTo(b)).toThrow(/different currencies/)
      expect(() => a.isGreaterThan(b)).toThrow(/different currencies/)
      expect(() => a.isLessThan(b)).toThrow(/different currencies/)
    })

    it('isEqual is FALSE (not a throw) across different currencies', () => {
      // Equality is a query, not an arithmetic op — different currencies are
      // simply not equal. Operating on them is what's forbidden.
      const a = Money.fromCents(1000, 'USD')
      const b = Money.fromCents(1000, 'BRL')
      expect(a.isEqual(b)).toBe(false)
    })

    it('multiply by zero yields zero in the same currency', () => {
      const zero = Money.fromCents(1234, 'BRL').multiply(0)
      expect(zero.getCents()).toBe(0)
      expect(zero.getCurrency()).toBe('BRL')
    })

    it('multiply by a negative scalar flips the sign', () => {
      expect(Money.fromCents(1000, 'BRL').multiply(-1).getCents()).toBe(-1000)
      expect(Money.fromCents(-100, 'BRL').multiply(-1).getCents()).toBe(100)
    })

    it('abs returns the magnitude in the same currency', () => {
      expect(Money.fromCents(-500, 'BRL').abs().getCents()).toBe(500)
      expect(Money.fromCents(500, 'BRL').abs().getCents()).toBe(500)
    })

    it('negate flips the sign without changing currency', () => {
      const negated = Money.fromCents(100, 'BRL').negate()
      expect(negated.getCents()).toBe(-100)
      expect(negated.getCurrency()).toBe('BRL')
    })

    it('isPositive / isNegative / isZero — boundary at zero', () => {
      expect(Money.zero('BRL').isPositive()).toBe(false)
      expect(Money.zero('BRL').isNegative()).toBe(false)
      expect(Money.zero('BRL').isZero()).toBe(true)
      expect(Money.fromCents(1, 'BRL').isPositive()).toBe(true)
      expect(Money.fromCents(-1, 'BRL').isNegative()).toBe(true)
    })

    it('compareTo returns sign of difference (same currency)', () => {
      const big = Money.fromCents(200, 'BRL')
      const small = Money.fromCents(100, 'BRL')
      expect(big.compareTo(small)).toBeGreaterThan(0)
      expect(small.compareTo(big)).toBeLessThan(0)
      expect(small.compareTo(small)).toBe(0)
    })
  })

  describe('safe-integer boundary (ADR-0004 documents the forward-looking policy)', () => {
    it('accepts MAX_SAFE_INTEGER', () => {
      expect(Money.fromCents(Number.MAX_SAFE_INTEGER, 'BRL').getCents()).toBe(
        Number.MAX_SAFE_INTEGER,
      )
    })

    it('THROWS at MAX_SAFE_INTEGER + 1 (no silent precision loss)', () => {
      expect(() => Money.fromCents(Number.MAX_SAFE_INTEGER + 1, 'BRL')).toThrow(
        InvalidValueObjectError,
      )
    })
  })

  describe('format', () => {
    it('formats 2-dp currencies with their symbol', () => {
      expect(Money.fromCents(10050, 'BRL').format()).toBe('R$ 100.50')
      expect(Money.fromCents(10050, 'BRL').format(false)).toBe('100.50')
    })

    it('formats a 0-dp currency without decimals', () => {
      expect(Money.fromCents(1000, 'JPY').format(false)).toBe('1,000')
    })

    it('exposes currency symbol for each supported currency', () => {
      expect(Money.zero('BRL').getCurrencySymbol()).toBe('R$')
      expect(Money.zero('USD').getCurrencySymbol()).toBe('$')
      expect(Money.zero('EUR').getCurrencySymbol()).toBe('€')
      expect(Money.zero('GBP').getCurrencySymbol()).toBe('£')
      expect(Money.zero('JPY').getCurrencySymbol()).toBe('¥')
    })

    it('formats with explicit symbol toggle off', () => {
      expect(Money.fromCents(-10050, 'USD').format(false)).toBe('-100.50')
    })

    it('formats negative amounts including the currency symbol', () => {
      expect(Money.fromCents(-10050, 'BRL').format()).toBe('R$ -100.50')
    })
  })

  describe('framework-mandated factories (playbook §2)', () => {
    it('create is an alias of fromCents', () => {
      expect(Money.create(1234, 'BRL').getCents()).toBe(1234)
    })

    it('buildExisting rehydrates an existing value', () => {
      const rebuilt = Money.buildExisting({ cents: 1234, currency: 'BRL' })
      expect(rebuilt.getCents()).toBe(1234)
      expect(rebuilt.getCurrency()).toBe('BRL')
    })
  })
})
