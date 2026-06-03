import { describe, expect, test } from "bun:test";
import { createContainer, token } from "../src/di";

describe("DI container", () => {
  test("resolves a registered factory once (singleton-by-default)", () => {
    const container = createContainer();
    const Svc = token<{ n: number }>("svc");
    let calls = 0;
    container.register(Svc, () => {
      calls++;
      return { n: 42 };
    });
    expect(container.resolve(Svc).n).toBe(42);
    container.resolve(Svc);
    expect(calls).toBe(1);
  });

  test("throws a fail-fast error on a missing provider", () => {
    const container = createContainer();
    expect(() => container.resolve(token("absent"))).toThrow(/no provider/);
  });

  test("registerValue short-circuits the factory", () => {
    const container = createContainer();
    const Cfg = token<string>("cfg");
    container.registerValue(Cfg, "ready");
    expect(container.resolve(Cfg)).toBe("ready");
  });
});
