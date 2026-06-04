import { describe, expect, test } from "bun:test";
import { formatConfigError, loadConfig } from "../src/config";

describe("loadConfig", () => {
  test("accepts a valid environment", () => {
    const result = loadConfig({ NODE_ENV: "production", PORT: "8080", LOG_LEVEL: "warn" });
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual({ NODE_ENV: "production", PORT: 8080, LOG_LEVEL: "warn" });
  });

  test("applies defaults for an empty environment (PORT 3333, never 3000)", () => {
    const config = loadConfig({}).unwrap();
    expect(config).toEqual({ NODE_ENV: "development", PORT: 3333, LOG_LEVEL: "info" });
  });

  test("strips unknown env keys (non-strict)", () => {
    const config = loadConfig({ PORT: "3333", PATH: "/usr/bin", RANDOM: "x" }).unwrap();
    expect(Object.keys(config).sort()).toEqual(["LOG_LEVEL", "NODE_ENV", "PORT"]);
  });

  test("freezes the parsed config", () => {
    const config = loadConfig({}).unwrap();
    expect(Object.isFrozen(config)).toBe(true);
  });

  test("rejects a non-numeric PORT", () => {
    const result = loadConfig({ PORT: "abc" });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().type).toBe("InvalidConfig");
  });

  test("rejects a PORT out of range", () => {
    expect(loadConfig({ PORT: "70000" }).isErr()).toBe(true);
  });

  test("rejects an unknown LOG_LEVEL", () => {
    expect(loadConfig({ LOG_LEVEL: "trace" }).isErr()).toBe(true);
  });
});

describe("formatConfigError", () => {
  test("renders a readable line per issue", () => {
    const error = loadConfig({ PORT: "abc" }).unwrapErr();
    const message = formatConfigError(error);
    expect(message).toContain("invalid configuration:");
    expect(message).toContain("PORT");
  });
});
