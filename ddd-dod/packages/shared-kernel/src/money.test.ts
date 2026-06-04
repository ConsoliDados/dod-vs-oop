import { describe, expect, test } from "bun:test";
import { Money } from "@ddd-dod/shared-kernel";

describe("Money.of", () => {
  test("accepts integer minor units + ISO-4217 currency", () => {
    const result = Money.of(1000, "USD");
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual({ amountMinor: 1000, currency: "USD" });
  });

  test("accumulates all violations (Notification pattern, no early return)", () => {
    const result = Money.of(10.5, "usd");
    expect(result.isErr()).toBe(true);
    const violations = result.unwrapErr();
    expect(violations.map((v) => v.property).sort()).toEqual(["amountMinor", "currency"]);
  });

  test("rejects cross-currency addition", () => {
    const a = Money.of(100, "USD").unwrap();
    const b = Money.of(100, "EUR").unwrap();
    expect(Money.add(a, b).isErr()).toBe(true);
  });

  test("adds same-currency amounts", () => {
    const a = Money.of(100, "USD").unwrap();
    const b = Money.of(250, "USD").unwrap();
    expect(Money.add(a, b).unwrap()).toEqual({ amountMinor: 350, currency: "USD" });
  });
});
