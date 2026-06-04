import { describe, expect, test } from "bun:test";
import { ConfigError, load } from "../src/config";

describe("loadConfig", () => {
  test("accepts a valid environment", () => {
    const result = load({ NODE_ENV: "production", PORT: "8080", LOG_LEVEL: "warn" });
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual({ NODE_ENV: "production", PORT: 8080, LOG_LEVEL: "warn" });
  });

  test("applies defaults for an empty environment (PORT 3333, never 3000)", () => {
    const config = load({}).unwrap();
    expect(config).toEqual({ NODE_ENV: "development", PORT: 3333, LOG_LEVEL: "info" });
  });

  test("strips unknown env keys (non-strict)", () => {
    const config = load({ PORT: "3333", PATH: "/usr/bin", RANDOM: "x" }).unwrap();
    expect(Object.keys(config).sort()).toEqual(["LOG_LEVEL", "NODE_ENV", "PORT"]);
  });

  test("freezes the parsed config", () => {
    const config = load({}).unwrap();
    expect(Object.isFrozen(config)).toBe(true);
  });

  test("rejects a non-numeric PORT with the InvalidEnv variant", () => {
    const result = load({ PORT: "abc" });
    expect(result.isErr()).toBe(true);
    expect("InvalidEnv" in result.unwrapErr()).toBe(true);
  });

  test("rejects a PORT out of range", () => {
    expect(load({ PORT: "70000" }).isErr()).toBe(true);
  });

  test("rejects an unknown LOG_LEVEL", () => {
    expect(load({ LOG_LEVEL: "trace" }).isErr()).toBe(true);
  });
});

describe("ConfigError", () => {
  test("format renders a readable line per issue (Display)", () => {
    const error = load({ PORT: "abc" }).unwrapErr();
    const message = ConfigError.format(error);
    expect(message).toContain("invalid configuration:");
    expect(message).toContain("PORT");
  });

  test("serialize yields a structured record with validator-neutral issues", () => {
    const error = load({ PORT: "abc" }).unwrapErr();
    const json = ConfigError.serialize(error);
    expect(json.kind).toBe("InvalidEnv");
    expect(Array.isArray(json.issues)).toBe(true);
  });

  test("format lists every issue, one line each", () => {
    const error = load({ PORT: "abc", LOG_LEVEL: "trace" }).unwrapErr();
    const message = ConfigError.format(error);
    expect(message).toContain("PORT");
    expect(message).toContain("LOG_LEVEL");
    expect(message.split("\n").length).toBeGreaterThanOrEqual(3); // header + 2 issue lines
  });
});
