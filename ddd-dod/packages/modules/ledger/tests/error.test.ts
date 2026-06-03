import { describe, expect, test } from "bun:test";
import { formatLedgerError, LedgerError } from "../src/error";

describe("LedgerError", () => {
  test("formats string and object variants through match", () => {
    expect(formatLedgerError(LedgerError.unbalancedTransaction())).toMatch(/balanced/);
    expect(formatLedgerError(LedgerError.currencyMismatch("USD", "EUR"))).toBe(
      "currency mismatch: expected USD, got EUR",
    );
  });
});
