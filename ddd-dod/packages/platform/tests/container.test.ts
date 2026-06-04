import { describe, expect, test } from "bun:test";
import { createContainer, type Disposable, token } from "../src/di";

describe("DI container — resolution", () => {
  test("resolves a registered singleton factory once (memoized)", () => {
    const c = createContainer();
    const Svc = token<{ n: number }>("svc");
    let calls = 0;
    c.register(Svc, () => {
      calls++;
      return { n: 42 };
    });
    expect(c.resolve(Svc).unwrap().n).toBe(42);
    c.resolve(Svc);
    expect(calls).toBe(1);
  });

  test("transient produces a fresh instance each resolve", () => {
    const c = createContainer();
    const Svc = token<{ id: number }>("t");
    let n = 0;
    c.register(Svc, () => ({ id: ++n }), { lifetime: "transient" });
    expect(c.resolve(Svc).unwrap().id).toBe(1);
    expect(c.resolve(Svc).unwrap().id).toBe(2);
  });

  test("registerValue short-circuits the factory path", () => {
    const c = createContainer();
    const Cfg = token<string>("cfg");
    c.registerValue(Cfg, "ready");
    expect(c.resolve(Cfg).unwrap()).toBe("ready");
  });
});

describe("DI container — never throws, returns Err", () => {
  test("Err(NotRegistered) for a missing provider", () => {
    const c = createContainer();
    const result = c.resolve(token("absent"));
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toHaveProperty("NotRegistered");
  });

  test("Err(FactoryFailed) when a factory throws", () => {
    const c = createContainer();
    const Boom = token("boom");
    c.register(Boom, () => {
      throw new Error("nope");
    });
    const result = c.resolve(Boom);
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toHaveProperty("FactoryFailed");
  });

  test("a dependency cycle resolves to an Err without throwing or hanging", () => {
    const c = createContainer();
    const A = token<unknown>("A");
    const B = token<unknown>("B");
    c.register(A, (ct) => ct.resolve(B).unwrap());
    c.register(B, (ct) => ct.resolve(A).unwrap());
    expect(() => c.resolve(A)).not.toThrow();
    expect(c.resolve(A).isErr()).toBe(true);
  });
});

describe("DI container — dispose", () => {
  test("disposes Disposable singletons in reverse creation order, swallowing failures", async () => {
    const c = createContainer();
    const order: string[] = [];
    const A = token<Disposable>("A");
    const B = token<Disposable>("B");
    c.register(A, () => ({
      dispose: () => {
        order.push("A");
      },
    }));
    c.register(B, () => ({
      dispose: () => {
        order.push("B");
        throw new Error("boom"); // swallowed + logged; must not stop A
      },
    }));
    c.resolve(A); // created first
    c.resolve(B); // created second
    await c.dispose();
    expect(order).toEqual(["B", "A"]);
  });
});
