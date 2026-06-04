import { describe, expect, test } from "bun:test";
import { create, type LogRecord, type LogSink } from "./index";

function captureSink(): { records: LogRecord[]; sink: LogSink } {
  const records: LogRecord[] = [];
  return {
    records,
    sink: {
      emit: (r) => {
        records.push(r);
      },
      flush: () => Promise.resolve(),
      dispose: () => Promise.resolve(),
    },
  };
}

describe("createLogger", () => {
  test("drops records below the threshold, keeps the rest with fields", () => {
    const { records, sink } = captureSink();
    const log = create({ level: "info", sink, context: "t" });
    log.debug("dropped");
    log.info("kept", { a: 1 });
    expect(records).toHaveLength(1);
    expect(records[0]?.message).toBe("kept");
    expect(records[0]?.fields).toEqual({ a: 1 });
  });

  test("redacts sensitive field keys", () => {
    const { records, sink } = captureSink();
    const log = create({ level: "info", sink });
    log.info("login", { password: "hunter2", user: "neo" });
    expect(records[0]?.fields).toEqual({ password: "[REDACTED]", user: "neo" });
  });

  test("child carries requestId without mutating the parent", () => {
    const { records, sink } = captureSink();
    const base = create({ level: "info", sink, context: "t" });
    base.child({ requestId: "req-1" }).info("scoped");
    base.info("root");
    expect(records[0]?.requestId).toBe("req-1");
    expect(records[1]?.requestId).toBeUndefined();
  });
});

describe("logger — error serialization", () => {
  test("error() normalizes a thrown Error onto record.err", () => {
    const { records, sink } = captureSink();
    create({ level: "info", sink }).error("failed", new Error("boom"));
    expect(records[0]?.err?.name).toBe("Error");
    expect(records[0]?.err?.message).toBe("boom");
    expect(typeof records[0]?.err?.stack).toBe("string");
  });

  test("error() walks the cause chain", () => {
    const { records, sink } = captureSink();
    create({ level: "info", sink }).error(
      "failed",
      new Error("outer", { cause: new Error("inner") }),
    );
    expect(records[0]?.err?.cause?.message).toBe("inner");
  });

  test("error() normalizes a non-Error thrown value", () => {
    const { records, sink } = captureSink();
    create({ level: "info", sink }).error("failed", "just a string");
    expect(records[0]?.err?.name).toBe("NonError");
    expect(records[0]?.err?.message).toBe("just a string");
  });
});

describe("logger — redaction depth & matching", () => {
  test("redacts nested object + array values by key, recursively", () => {
    const { records, sink } = captureSink();
    create({ level: "info", sink }).info("x", {
      user: { name: "neo", password: "hunter2" },
      tokens: [{ token: "abc" }],
    });
    expect(records[0]?.fields).toEqual({
      user: { name: "neo", password: "[REDACTED]" },
      tokens: [{ token: "[REDACTED]" }],
    });
  });

  test("matches sensitive keys case-insensitively", () => {
    const { records, sink } = captureSink();
    create({ level: "info", sink }).info("x", { Authorization: "Bearer z", SECRET: "s" });
    expect(records[0]?.fields).toEqual({ Authorization: "[REDACTED]", SECRET: "[REDACTED]" });
  });

  test("honors caller-extended redact keys (defaults cannot be shrunk)", () => {
    const { records, sink } = captureSink();
    create({ level: "info", sink, redactKeys: ["ssn"] }).info("x", { ssn: "123", token: "t" });
    expect(records[0]?.fields).toEqual({ ssn: "[REDACTED]", token: "[REDACTED]" });
  });
});
