import { describe, expect, test } from "bun:test";
import { ReconciliationError } from "../src/error";

describe("ReconciliationError", () => {
  test("format renders string and object variants through match", () => {
    expect(ReconciliationError.format(ReconciliationError.batchNotFound())).toBe(
      "reconciliation batch not found",
    );
    expect(ReconciliationError.format(ReconciliationError.toleranceExceeded(150, 100))).toBe(
      "tolerance exceeded: delta 150 > 100",
    );
  });

  test("serialize yields a flat structured record", () => {
    expect(ReconciliationError.serialize(ReconciliationError.toleranceExceeded(150, 100))).toEqual({
      kind: "ToleranceExceeded",
      delta: 150,
      tolerance: 100,
    });
  });
});
