import { describe, expect, test } from "bun:test";
import { create, type LogRecord, type LogSink } from "../src/logger";

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
