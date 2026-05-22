import { InvalidPropertyError, InvalidValueObjectError } from '../../core/errors'
import { Validator } from '../../core/services/validator'
import { ValueObject } from '../../core/value-objects/value-object'

export type Currency = 'BRL' | 'USD' | 'EUR' | 'GBP' | 'JPY'

interface CurrencyMetadata {
  code: Currency
  symbol: string
  name: string
  decimalPlaces: number
}

const CURRENCY_CONFIG: ReadonlyMap<Currency, CurrencyMetadata> = new Map([
  ['BRL', { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', decimalPlaces: 2 }],
  ['USD', { code: 'USD', symbol: '$', name: 'US Dollar', decimalPlaces: 2 }],
  ['EUR', { code: 'EUR', symbol: '€', name: 'Euro', decimalPlaces: 2 }],
  ['GBP', { code: 'GBP', symbol: '£', name: 'British Pound', decimalPlaces: 2 }],
  ['JPY', { code: 'JPY', symbol: '¥', name: 'Japanese Yen', decimalPlaces: 0 }],
])

/**
 * Internal representation: integer minor units (cents) + currency.
 * `cents` is always a safe integer at the currency's natural scale
 * (2 dp for BRL/USD/EUR/GBP → cents; 0 dp for JPY → whole yen).
 */
export interface MoneyValue {
  cents: number
  currency: Currency
}

/**
 * Rounds a (possibly fractional) value to the nearest integer using
 * **half-even** (banker's) rounding: exact `.5` ties round to the nearest
 * even integer. Used for the only operations that can produce fractions —
 * `multiply` / `divide` by a scalar and decimal parsing at the boundary.
 *
 * @see ADR-0004 (Money as integer minor units)
 */
function roundHalfEven(value: number): number {
  const floor = Math.floor(value)
  const diff = value - floor
  if (diff < 0.5) return floor
  if (diff > 0.5) return floor + 1
  // exactly .5 → round to the even neighbour
  return floor % 2 === 0 ? floor : floor + 1
}

/**
 * Money Value Object — **integer minor units** (ADR-0004, SRS §6).
 *
 * Throw-based: a non-integer / NaN / unsupported-currency value throws
 * `InvalidValueObjectError` at construction; mismatched currency on arithmetic
 * throws a plain `Error`. Instances are always valid by construction.
 *
 * Construction:
 * - `fromCents(cents, currency)` — primary ctor; `cents` must be a safe integer.
 * - `fromDecimal(value, currency)` — boundary helper; rounds half-even to cents.
 * - `create` / `buildExisting` — framework-mandated factories (playbook §2),
 *   both delegate to `fromCents`.
 *
 * Arithmetic: add/subtract are exact integer ops; multiply/divide by a scalar
 * round half-even to whole minor units.
 */
export class Money extends ValueObject<MoneyValue, InvalidValueObjectError> {
  private validator: MoneyValidator

  private constructor(value: MoneyValue) {
    super(value)
    this.validator = new MoneyValidator(this)
  }

  /** Primary constructor: build from integer minor units (cents). */
  static fromCents(cents: number, currency: Currency): Money {
    const money = new Money({ cents, currency })
    money.validator.validate()
    return money
  }

  /**
   * Boundary helper: build from a decimal major-unit value (e.g. `100.50`),
   * rounding half-even to the currency's natural minor unit. Use only at input
   * boundaries — the ledger itself always works in whole minor units.
   */
  static fromDecimal(value: number, currency: Currency): Money {
    const multiplier = 10 ** decimalPlacesOf(currency)
    return Money.fromCents(roundHalfEven(value * multiplier), currency)
  }

  /** Framework-mandated factory (playbook §2). Alias of {@link Money.fromCents}. */
  static create(cents: number, currency: Currency): Money {
    return Money.fromCents(cents, currency)
  }

  /** Framework-mandated factory (playbook §2). Rehydrates from a persisted value. */
  static buildExisting(value: MoneyValue): Money {
    return Money.fromCents(value.cents, value.currency)
  }

  static zero(currency: Currency): Money {
    return Money.fromCents(0, currency)
  }

  public getCents(): number {
    return this.value.cents
  }

  public getCurrency(): Currency {
    return this.value.currency
  }

  public getCurrencySymbol(): string {
    return CURRENCY_CONFIG.get(this.value.currency)?.symbol ?? ''
  }

  public isZero(): boolean {
    return this.value.cents === 0
  }

  public isPositive(): boolean {
    return this.value.cents > 0
  }

  public isNegative(): boolean {
    return this.value.cents < 0
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other)
    return Money.fromCents(this.value.cents + other.value.cents, this.value.currency)
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other)
    return Money.fromCents(this.value.cents - other.value.cents, this.value.currency)
  }

  /** Multiply by a scalar; rounds half-even to whole minor units. */
  public multiply(multiplier: number): Money {
    return Money.fromCents(roundHalfEven(this.value.cents * multiplier), this.value.currency)
  }

  /** Divide by a scalar; rounds half-even to whole minor units. */
  public divide(divisor: number): Money {
    if (divisor === 0) throw new Error('Cannot divide money by zero')
    return Money.fromCents(roundHalfEven(this.value.cents / divisor), this.value.currency)
  }

  public abs(): Money {
    return Money.fromCents(Math.abs(this.value.cents), this.value.currency)
  }

  public negate(): Money {
    return Money.fromCents(-this.value.cents, this.value.currency)
  }

  public compareTo(other: Money): number {
    this.assertSameCurrency(other)
    return this.value.cents - other.value.cents
  }

  public isEqual(other: Money): boolean {
    return this.value.currency === other.value.currency && this.value.cents === other.value.cents
  }

  public isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other)
    return this.value.cents > other.value.cents
  }

  public isLessThan(other: Money): boolean {
    this.assertSameCurrency(other)
    return this.value.cents < other.value.cents
  }

  /** Formats the value as a decimal string at the currency's natural scale. */
  public format(includeSymbol = true): string {
    const decimalPlaces = decimalPlacesOf(this.value.currency)
    const major = this.value.cents / 10 ** decimalPlaces
    const formatted = major.toLocaleString('en-US', {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    })
    return includeSymbol ? `${this.getCurrencySymbol()} ${formatted}` : formatted
  }

  private assertSameCurrency(other: Money): void {
    if (this.value.currency !== other.value.currency) {
      throw new Error(
        `Cannot operate on different currencies: ${this.value.currency} and ${other.value.currency}`,
      )
    }
  }
}

function decimalPlacesOf(currency: Currency): number {
  return CURRENCY_CONFIG.get(currency)?.decimalPlaces ?? 2
}

class MoneyValidator extends Validator<Money, InvalidValueObjectError> {
  override validate(): void {
    this.clearErrors()
    const { cents, currency } = this.clazz.getValue()

    if (typeof cents !== 'number') {
      this.addError(new InvalidPropertyError('cents', 'Cents must be a number'))
    } else if (Number.isNaN(cents)) {
      this.addError(new InvalidPropertyError('cents', 'Cents cannot be NaN'))
    } else if (!Number.isFinite(cents)) {
      this.addError(new InvalidPropertyError('cents', 'Cents must be finite'))
    } else if (!Number.isInteger(cents)) {
      this.addError(new InvalidPropertyError('cents', 'Cents must be an integer (minor units)'))
    } else if (!Number.isSafeInteger(cents)) {
      this.addError(new InvalidPropertyError('cents', 'Cents exceeds the safe integer range'))
    }

    if (!currency) {
      this.addError(new InvalidPropertyError('currency', 'Currency is required'))
    } else if (!CURRENCY_CONFIG.has(currency)) {
      this.addError(new InvalidPropertyError('currency', `Unsupported currency: ${currency}`))
    }

    if (this.hasErrors()) {
      throw new InvalidValueObjectError('Money', this.getErrors())
    }
  }
}
