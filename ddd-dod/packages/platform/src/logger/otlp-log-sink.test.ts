import { describe, expect, test } from "bun:test";
import { create, createOtlpLogSink, type OtelLogData, type OtelLogEmitter } from "./index";

function captureEmitter(): { records: OtelLogData[]; emitter: OtelLogEmitter } {
  const records: OtelLogData[] = [];
  return {
    records,
    emitter: {
      emit: (r) => {
        records.push(r);
      },
    },
  };
}

describe("createOtlpLogSink", () => {
  test("maps level to OTel severity, message to body, fields to attributes", () => {
    const { records, emitter } = captureEmitter();
    const log = create({ level: "debug", sink: createOtlpLogSink(emitter), context: "ctx" });
    log.warn("careful", { a: 1 });
    expect(records).toHaveLength(1);
    expect(records[0]?.severityNumber).toBe(13);
    expect(records[0]?.severityText).toBe("WARN");
    expect(records[0]?.body).toBe("careful");
    expect(records[0]?.attributes).toMatchObject({ context: "ctx", a: 1 });
  });

  test("carries requestId from a child and flattens an error", () => {
    const { records, emitter } = captureEmitter();
    const log = create({ level: "info", sink: createOtlpLogSink(emitter) }).child({
      requestId: "req-9",
    });
    log.error("boom", new Error("nope"));
    expect(records[0]?.severityNumber).toBe(17);
    expect(records[0]?.attributes.requestId).toBe("req-9");
    expect(records[0]?.attributes["error.name"]).toBe("Error");
    expect(records[0]?.attributes["error.message"]).toBe("nope");
  });

  test("never throws when the emitter throws", () => {
    const sink = createOtlpLogSink({
      emit: () => {
        throw new Error("transport down");
      },
    });
    const log = create({ level: "info", sink });
    expect(() => log.info("still fine")).not.toThrow();
  });
});
