import { describe, expect, test } from "bun:test";
import { formatStatementsError, StatementsError } from "../src/error";

describe("StatementsError", () => {
  test("formats string and object variants through match", () => {
    expect(formatStatementsError(StatementsError.accountNotFound())).toBe("account not found");
    expect(formatStatementsError(StatementsError.invalidPeriod("2026-01-01", "2025-12-31"))).toBe(
      "invalid period: 2026-01-01..2025-12-31",
    );
  });
});
