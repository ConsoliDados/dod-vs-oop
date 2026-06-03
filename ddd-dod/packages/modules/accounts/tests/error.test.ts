import { describe, expect, test } from "bun:test";
import { AccountsError, formatAccountsError } from "../src/error";

describe("AccountsError", () => {
  test("formats string and object variants through match", () => {
    expect(formatAccountsError(AccountsError.accountNotFound())).toBe("account not found");
    expect(formatAccountsError(AccountsError.frozen("2026-06-03"))).toBe(
      "account is frozen since 2026-06-03",
    );
  });
});
