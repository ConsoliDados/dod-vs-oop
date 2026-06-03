import { describe, expect, test } from "bun:test";
import { formatReconciliationError, ReconciliationError } from "../src/error";

describe("ReconciliationError", () => {
  test("formats string and object variants through match", () => {
    expect(formatReconciliationError(ReconciliationError.batchNotFound())).toBe(
      "reconciliation batch not found",
    );
    expect(formatReconciliationError(ReconciliationError.toleranceExceeded(150, 100))).toBe(
      "tolerance exceeded: delta 150 > 100",
    );
  });
});
