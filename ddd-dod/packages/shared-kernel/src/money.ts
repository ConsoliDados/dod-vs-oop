import type { InvalidProperty } from "./result";

/** ISO-4217 alpha-3 currency code (validated by the smart constructor). */
export type Currency = string;

/**
 * Money as **integer minor units** (cents) plus a currency — no floating point,
 * no decimal library (the DOD counterpart of `ddd-classic`'s Money VO). A plain
 * readonly value; behavior lives in the companion functions below, not methods.
 *
 * # Invariants
 * - `amountMinor` is an integer (minor units). Fractional input is rejected.
 * - `currency` is an ISO-4217 alpha-3 code.
 * - Arithmetic across mismatched currencies is rejected, never coerced.
 */
export interface Money {
  readonly amountMinor: number;
  readonly currency: Currency;
}

const CURRENCY_RE = /^[A-Z]{3}$/;

export const Money = {
  /** Smart constructor — accumulates violations (Notification pattern). */
  of(amountMinor: number, currency: string): Result<Money, InvalidProperty[]> {
    const violations: InvalidProperty[] = [];
    if (!Number.isInteger(amountMinor)) {
      violations.push({
        property: "amountMinor",
        message: `must be an integer in minor units, got ${amountMinor}`,
      });
    }
    if (!CURRENCY_RE.test(currency)) {
      violations.push({
        property: "currency",
        message: `must be an ISO-4217 alpha-3 code, got "${currency}"`,
      });
    }
    if (violations.length > 0) {
      return Err(violations);
    }
    return Ok({ amountMinor, currency });
  },

  zero(currency: Currency): Money {
    return { amountMinor: 0, currency };
  },

  add(a: Money, b: Money): Result<Money, InvalidProperty[]> {
    if (a.currency !== b.currency) {
      return Err([{ property: "currency", message: `cannot add ${b.currency} to ${a.currency}` }]);
    }
    return Ok({ amountMinor: a.amountMinor + b.amountMinor, currency: a.currency });
  },

  negate(m: Money): Money {
    return { amountMinor: -m.amountMinor, currency: m.currency };
  },

  isZero(m: Money): boolean {
    return m.amountMinor === 0;
  },

  equals(a: Money, b: Money): boolean {
    return a.amountMinor === b.amountMinor && a.currency === b.currency;
  },
};
