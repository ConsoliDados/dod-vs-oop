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

export interface MoneyValue {
  amount: number
  currency: Currency
}

/**
 * Money Value Object with currency-aware arithmetic.
 *
 * Throw-based: invalid amount/currency throws `InvalidValueObjectError` at
 * construction; mismatched currency on arithmetic throws plain `Error`.
 */
export class Money extends ValueObject<MoneyValue, InvalidValueObjectError> {
  private validator: MoneyValidator

  private constructor(value: MoneyValue) {
    super(value)
    this.validator = new MoneyValidator(this)
  }

  static create(amount: number, currency: Currency): Money {
    const money = new Money({ amount, currency })
    money.validator.validate()
    return money
  }

  static buildExisting(value: MoneyValue): Money {
    return Money.create(value.amount, value.currency)
  }

  static zero(currency: Currency): Money {
    return Money.create(0, currency)
  }

  public getAmount(): number {
    return this.value.amount
  }

  public getCurrency(): Currency {
    return this.value.currency
  }

  public getCurrencySymbol(): string {
    return CURRENCY_CONFIG.get(this.value.currency)?.symbol ?? ''
  }

  public isZero(): boolean {
    return this.value.amount === 0
  }

  public isPositive(): boolean {
    return this.value.amount > 0
  }

  public isNegative(): boolean {
    return this.value.amount < 0
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other)
    return Money.create(
      this.roundAmount(this.value.amount + other.value.amount),
      this.value.currency,
    )
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other)
    return Money.create(
      this.roundAmount(this.value.amount - other.value.amount),
      this.value.currency,
    )
  }

  public multiply(multiplier: number): Money {
    return Money.create(this.roundAmount(this.value.amount * multiplier), this.value.currency)
  }

  public divide(divisor: number): Money {
    if (divisor === 0) throw new Error('Cannot divide money by zero')
    return Money.create(this.roundAmount(this.value.amount / divisor), this.value.currency)
  }

  public abs(): Money {
    return Money.create(Math.abs(this.value.amount), this.value.currency)
  }

  public negate(): Money {
    return Money.create(-this.value.amount, this.value.currency)
  }

  public compareTo(other: Money): number {
    this.assertSameCurrency(other)
    return this.value.amount - other.value.amount
  }

  public isEqual(other: Money): boolean {
    return this.value.currency === other.value.currency && this.value.amount === other.value.amount
  }

  public isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other)
    return this.value.amount > other.value.amount
  }

  public isLessThan(other: Money): boolean {
    this.assertSameCurrency(other)
    return this.value.amount < other.value.amount
  }

  public format(includeSymbol = true): string {
    const decimalPlaces = this.getDecimalPlaces()
    const formattedAmount = this.value.amount.toLocaleString('en-US', {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    })
    return includeSymbol ? `${this.getCurrencySymbol()} ${formattedAmount}` : formattedAmount
  }

  private getDecimalPlaces(): number {
    return CURRENCY_CONFIG.get(this.value.currency)?.decimalPlaces ?? 2
  }

  private roundAmount(amount: number): number {
    const decimalPlaces = this.getDecimalPlaces()
    const multiplier = 10 ** decimalPlaces
    return Math.round(amount * multiplier) / multiplier
  }

  private assertSameCurrency(other: Money): void {
    if (this.value.currency !== other.value.currency) {
      throw new Error(
        `Cannot operate on different currencies: ${this.value.currency} and ${other.value.currency}`,
      )
    }
  }
}

class MoneyValidator extends Validator<Money, InvalidValueObjectError> {
  override validate(): void {
    this.clearErrors()
    const value = this.clazz.getValue()

    if (typeof value.amount !== 'number') {
      this.addError(new InvalidPropertyError('amount', 'Amount must be a number'))
    }
    if (Number.isNaN(value.amount)) {
      this.addError(new InvalidPropertyError('amount', 'Amount cannot be NaN'))
    }
    if (!Number.isFinite(value.amount)) {
      this.addError(new InvalidPropertyError('amount', 'Amount must be finite'))
    }
    if (!value.currency) {
      this.addError(new InvalidPropertyError('currency', 'Currency is required'))
    }
    if (value.currency && !CURRENCY_CONFIG.has(value.currency)) {
      this.addError(new InvalidPropertyError('currency', `Unsupported currency: ${value.currency}`))
    }

    if (this.hasErrors()) {
      throw new InvalidValueObjectError('Money', this.getErrors())
    }
  }
}
