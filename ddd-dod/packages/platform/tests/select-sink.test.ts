import { describe, expect, test } from "bun:test";
import { create, type OtelLogData, selectSink } from "../src/logger";

describe("selectSink", () => {
  test("production with an otel emitter routes logs to OTLP", () => {
    const records: OtelLogData[] = [];
    const sink = selectSink({
      nodeEnv: "production",
      otelEmitter: {
        emit: (r) => {
          records.push(r);
        },
      },
    });
    create({ level: "info", sink }).info("hi");
    expect(records).toHaveLength(1);
    expect(records[0]?.body).toBe("hi");
  });

  test("production without an emitter falls back to console (no OTLP needed)", () => {
    const sink = selectSink({ nodeEnv: "production" });
    expect(() => create({ level: "error", sink }).error("fallback")).not.toThrow();
  });

  test("development selects a console sink", () => {
    const sink = selectSink({ nodeEnv: "development" });
    expect(() => create({ level: "error", sink }).error("dev")).not.toThrow();
  });
});
