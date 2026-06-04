import { describe, expect, test } from "bun:test";
import { AccountsError } from "../src/error";

describe("AccountsError", () => {
  test("format renders string and object variants through match", () => {
    expect(AccountsError.format(AccountsError.accountNotFound())).toBe("account not found");
    expect(AccountsError.format(AccountsError.frozen("2026-06-03"))).toBe(
      "account is frozen since 2026-06-03",
    );
  });

  test("serialize yields a flat structured record (cause stringified)", () => {
    expect(AccountsError.serialize(AccountsError.frozen("2026-06-03"))).toEqual({
      kind: "Frozen",
      since: "2026-06-03",
    });
    expect(AccountsError.serialize(AccountsError.infra(new Error("boom")))).toEqual({
      kind: "Infra",
      cause: "Error: boom",
    });
  });
});
