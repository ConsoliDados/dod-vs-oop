import { describe, expect, test } from "bun:test";
import { createContainer, type Disposable, token } from "./index";

describe("DI container — resolution (all-async)", () => {
  test("resolves a registered singleton factory once (memoized)", async () => {
    const c = createContainer();
    const Svc = token<{ n: number }>("svc");
    let calls = 0;
    c.register(Svc, () => {
      calls++;
      return { n: 42 };
    });
    expect((await c.resolve(Svc)).unwrap().n).toBe(42);
    await c.resolve(Svc);
    expect(calls).toBe(1);
  });

  test("transient produces a fresh instance each resolve", async () => {
    const c = createContainer();
    const Svc = token<{ id: number }>("t");
    let n = 0;
    c.register(Svc, () => ({ id: ++n }), { lifetime: "transient" });
    expect((await c.resolve(Svc)).unwrap().id).toBe(1);
    expect((await c.resolve(Svc)).unwrap().id).toBe(2);
  });

  test("registerValue short-circuits the factory path", async () => {
    const c = createContainer();
    const Cfg = token<string>("cfg");
    c.registerValue(Cfg, "ready");
    expect((await c.resolve(Cfg)).unwrap()).toBe("ready");
  });

  test("the magic register: an async factory is awaited transparently", async () => {
    const c = createContainer();
    const Db = token<{ url: string }>("db");
    c.register(Db, async () => {
      await Promise.resolve();
      return { url: "sqlite://:memory:" };
    });
    const db = (await c.resolve(Db)).unwrap();
    expect(db.url).toBe("sqlite://:memory:");
  });

  test("a factory resolves its own dependencies via the injected container", async () => {
    const c = createContainer();
    const Dep = token<number>("dep");
    const Svc = token<{ doubled: number }>("svc2");
    c.register(Dep, () => 21);
    c.register(Svc, async (ct) => ({ doubled: (await ct.resolve(Dep)).unwrap() * 2 }));
    expect((await c.resolve(Svc)).unwrap().doubled).toBe(42);
  });
});

describe("DI container — single-flight", () => {
  test("concurrent resolves of one async singleton build it exactly once", async () => {
    const c = createContainer();
    const Slow = token<{ id: number }>("slow");
    let calls = 0;
    c.register(Slow, async () => {
      calls++;
      await Promise.resolve();
      return { id: calls };
    });
    const [a, b, d] = await Promise.all([c.resolve(Slow), c.resolve(Slow), c.resolve(Slow)]);
    expect(calls).toBe(1);
    expect(a.unwrap()).toBe(b.unwrap());
    expect(b.unwrap()).toBe(d.unwrap());
  });

  test("a rejected factory clears the in-flight entry so a later resolve can retry", async () => {
    const c = createContainer();
    const Flaky = token<string>("flaky");
    let attempt = 0;
    c.register(Flaky, async () => {
      attempt++;
      if (attempt === 1) throw new Error("first fails");
      return "second ok";
    });
    expect((await c.resolve(Flaky)).isErr()).toBe(true);
    expect((await c.resolve(Flaky)).unwrap()).toBe("second ok");
    expect(attempt).toBe(2);
  });
});

describe("DI container — never throws, returns Err", () => {
  test("Err(NotRegistered) for a missing provider", async () => {
    const c = createContainer();
    const result = await c.resolve(token("absent"));
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toHaveProperty("NotRegistered");
  });

  test("Err(FactoryFailed) when a sync factory throws", async () => {
    const c = createContainer();
    const Boom = token("boom");
    c.register(Boom, () => {
      throw new Error("nope");
    });
    expect((await c.resolve(Boom)).unwrapErr()).toHaveProperty("FactoryFailed");
  });

  test("Err(FactoryFailed) when an async factory rejects", async () => {
    const c = createContainer();
    const Boom = token("boom-async");
    c.register(Boom, async () => {
      throw new Error("async nope");
    });
    expect((await c.resolve(Boom)).unwrapErr()).toHaveProperty("FactoryFailed");
  });

  test("an async dependency cycle resolves to an Err without throwing or hanging", async () => {
    const c = createContainer();
    const A = token<unknown>("A");
    const B = token<unknown>("B");
    c.register(A, async (ct) => (await ct.resolve(B)).unwrap());
    c.register(B, async (ct) => (await ct.resolve(A)).unwrap());
    const result = await c.resolve(A);
    expect(result.isErr()).toBe(true);
  });

  test("the factory that closes the loop sees Err(CircularDependency)", async () => {
    const c = createContainer();
    const A = token<string>("cycleA");
    const B = token<string>("cycleB");
    let bSawForA: unknown = null;
    c.register(A, async (ct) => {
      await ct.resolve(B);
      return "a";
    });
    c.register(B, async (ct) => {
      const r = await ct.resolve(A); // A is mid-build -> closes the loop
      bSawForA = r.isErr() ? r.unwrapErr() : null;
      return "b";
    });
    await c.resolve(A);
    expect(bSawForA).toHaveProperty("CircularDependency");
  });
});

describe("DI container — peek (sync escape hatch)", () => {
  test("returns a built singleton synchronously", async () => {
    const c = createContainer();
    const Svc = token<number>("peek-svc");
    c.register(Svc, () => 7);
    await c.resolve(Svc); // build it
    expect(c.peek(Svc).unwrap()).toBe(7);
  });

  test("registerValue is peekable immediately", () => {
    const c = createContainer();
    const Cfg = token<string>("peek-cfg");
    c.registerValue(Cfg, "v");
    expect(c.peek(Cfg).unwrap()).toBe("v");
  });

  test("Err(NotResolved) when registered but not yet built", () => {
    const c = createContainer();
    const Svc = token<number>("peek-unbuilt");
    c.register(Svc, () => 1);
    expect(c.peek(Svc).unwrapErr()).toHaveProperty("NotResolved");
  });

  test("Err(NotRegistered) when absent", () => {
    const c = createContainer();
    expect(c.peek(token("peek-absent")).unwrapErr()).toHaveProperty("NotRegistered");
  });
});

describe("DI container — dispose & the transient-disposable leak fix", () => {
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
    await c.resolve(A); // created first
    await c.resolve(B); // created second
    await c.dispose();
    expect(order).toEqual(["B", "A"]);
  });

  test("onDispose callbacks run interleaved with resolved Disposables, reverse order", async () => {
    const c = createContainer();
    const order: string[] = [];
    const A = token<Disposable>("A");
    c.register(A, () => ({
      dispose: () => {
        order.push("A-disposable");
      },
    }));
    await c.resolve(A); // tracked first
    c.onDispose(() => {
      order.push("callback");
    }); // tracked second
    await c.dispose();
    expect(order).toEqual(["callback", "A-disposable"]);
  });

  test("does NOT track transient Disposables — the caller owns their lifecycle (no leak)", async () => {
    const c = createContainer();
    let disposed = 0;
    const T = token<Disposable>("transient-disposable");
    c.register(
      T,
      () => ({
        dispose: () => {
          disposed++;
        },
      }),
      { lifetime: "transient" },
    );
    // resolve it many times — a leak would push one teardown per resolve
    for (let i = 0; i < 50; i++) {
      await c.resolve(T);
    }
    await c.dispose();
    expect(disposed).toBe(0); // container never disposes transients
  });
});

describe("DI container — scopes", () => {
  test("singletons are shared between the root and its scopes", async () => {
    const root = createContainer();
    const Svc = token<{ id: number }>("scoped-singleton");
    let n = 0;
    root.register(Svc, () => ({ id: ++n }));
    const fromRoot = (await root.resolve(Svc)).unwrap();
    const scope = root.createScope();
    const fromScope = (await scope.resolve(Svc)).unwrap();
    expect(fromScope).toBe(fromRoot); // same instance — built once on the root
    expect(n).toBe(1);
  });

  test("a scoped lifetime yields one instance per scope", async () => {
    const root = createContainer();
    const Tx = token<{ id: number }>("tx");
    let n = 0;
    root.register(Tx, () => ({ id: ++n }), { lifetime: "scoped" });
    const s1 = root.createScope();
    const s2 = root.createScope();
    const a1 = (await s1.resolve(Tx)).unwrap();
    const a2 = (await s1.resolve(Tx)).unwrap(); // same scope -> same instance
    const b1 = (await s2.resolve(Tx)).unwrap(); // other scope -> different instance
    expect(a1).toBe(a2);
    expect(b1).not.toBe(a1);
    expect(n).toBe(2);
  });

  test("scope.dispose tears down only the scope's instances, leaving the root intact", async () => {
    const root = createContainer();
    const disposed: string[] = [];
    const RootSvc = token<Disposable>("root-disposable");
    const ScopedSvc = token<Disposable>("scoped-disposable");
    root.register(RootSvc, () => ({ dispose: () => void disposed.push("root") }));
    root.register(ScopedSvc, () => ({ dispose: () => void disposed.push("scope") }), {
      lifetime: "scoped",
    });
    await root.resolve(RootSvc);
    const scope = root.createScope();
    await scope.resolve(ScopedSvc);

    await scope.dispose();
    expect(disposed).toEqual(["scope"]); // root singleton untouched

    await root.dispose();
    expect(disposed).toEqual(["scope", "root"]);
  });
});
