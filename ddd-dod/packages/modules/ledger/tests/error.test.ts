import { describe, expect, test } from "bun:test";
import { LedgerError } from "../src/error";

describe("LedgerError", () => {
  test("format renders string and object variants through match", () => {
    expect(LedgerError.format(LedgerError.unbalancedTransaction())).toMatch(/balanced/);
    expect(LedgerError.format(LedgerError.currencyMismatch("USD", "EUR"))).toBe(
      "currency mismatch: expected USD, got EUR",
    );
  });

  test("serialize yields a flat structured record", () => {
    expect(LedgerError.serialize(LedgerError.currencyMismatch("USD", "EUR"))).toEqual({
      kind: "CurrencyMismatch",
      expected: "USD",
      got: "EUR",
    });
  });
});
