import { describe, expect, test } from "bun:test";
import { StatementsError } from "./error";

describe("StatementsError", () => {
  test("format renders string and object variants through match", () => {
    expect(StatementsError.format(StatementsError.accountNotFound())).toBe("account not found");
    expect(StatementsError.format(StatementsError.invalidPeriod("2026-01-01", "2025-12-31"))).toBe(
      "invalid period: 2026-01-01..2025-12-31",
    );
  });

  test("serialize yields a flat structured record", () => {
    expect(
      StatementsError.serialize(StatementsError.invalidPeriod("2026-01-01", "2025-12-31")),
    ).toEqual({ kind: "InvalidPeriod", from: "2026-01-01", to: "2025-12-31" });
  });
});
