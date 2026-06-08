import { describe, expect, test } from "bun:test";
import { type DispatchContext, fifoBackpressure, roundRobin } from "./dispatch";
import type { WorkerPoolError } from "./errors";

/**
 * Unit tests for the dispatch strategies **in isolation**: a fake transport (no
 * real workers) records send order + live concurrency, so the scheduling
 * invariants are deterministic — no worker timing to race. The real-Bun-worker
 * path is covered end-to-end by `worker-pool.test.ts` and the worker+DI
 * integration test. See ADR-0013.
 */
interface FakeTransport {
  readonly ctx: DispatchContext;
  /** Every `send`, in call order. */
  readonly sends: ReadonlyArray<{ index: number; payload: unknown }>;
  /** Peak number of simultaneously in-flight sends. */
  readonly maxInFlight: number;
  /** Settle the oldest in-flight send with `Ok` (FIFO completion). */
  finishOldest(): void;
  /** Settle every in-flight send with `Ok`. */
  finishAll(): void;
}

function fakeTransport(size: number): FakeTransport {
  const sends: { index: number; payload: unknown }[] = [];
  const inflight: Array<(r: Result<unknown, WorkerPoolError>) => void> = [];
  let live = 0;
  let peak = 0;
  return {
    ctx: {
      size,
      send(index, payload) {
        sends.push({ index, payload });
        live++;
        peak = Math.max(peak, live);
        return new Promise((resolve) => {
          inflight.push((r) => {
            live--;
            resolve(r);
          });
        });
      },
    },
    sends,
    get maxInFlight() {
      return peak;
    },
    finishOldest() {
      inflight.shift()?.(Ok(undefined));
    },
    finishAll() {
      while (inflight.length > 0) {
        (inflight.shift() as (r: Result<unknown, WorkerPoolError>) => void)(Ok(undefined));
      }
    },
  };
}

/** Flush the microtask queue so the strategies' `.then` chains settle. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("dispatch — fifoBackpressure", () => {
  test("caps in-flight at the worker count and queues the rest FIFO", async () => {
    const t = fakeTransport(2);
    const order: number[] = [];
    const s = fifoBackpressure();
    s.bind(t.ctx);

    for (let i = 0; i < 5; i++) {
      s.submit({ payload: i, settle: () => order.push(i) });
    }
    // size=2 → exactly 2 dispatched immediately, 3 held in the queue.
    expect(t.sends.map((x) => x.payload)).toEqual([0, 1]);

    t.finishOldest(); // task 0 frees a worker → task 2 dispatches
    await flush();
    expect(t.sends.map((x) => x.payload)).toEqual([0, 1, 2]);

    t.finishOldest(); // task 1 → task 3
    await flush();
    t.finishOldest(); // task 2 → task 4
    await flush();
    expect(t.sends.map((x) => x.payload)).toEqual([0, 1, 2, 3, 4]);

    // Never more than `size` jobs on workers at once.
    expect(t.maxInFlight).toBe(2);

    t.finishAll();
    await flush();
    expect(order).toEqual([0, 1, 2, 3, 4]);
  });

  test("drain settles every queued task as Err(PoolDisposed) (in-flight is the pool's concern)", () => {
    const t = fakeTransport(1);
    const results: Result<unknown, WorkerPoolError>[] = [];
    const s = fifoBackpressure();
    s.bind(t.ctx);

    for (let i = 0; i < 3; i++) {
      s.submit({ payload: i, settle: (r) => results.push(r) });
    }
    // 1 worker → 1 in-flight, 2 queued.
    expect(t.sends.length).toBe(1);

    s.drain();
    expect(results.length).toBe(2); // only the queued ones
    expect(results.every((r) => r.unwrapErr() === "PoolDisposed")).toBe(true);
  });
});

describe("dispatch — roundRobin", () => {
  test("spreads tasks across workers cyclically and never backpressures", () => {
    const t = fakeTransport(2);
    const s = roundRobin();
    s.bind(t.ctx);

    for (let i = 0; i < 5; i++) {
      s.submit({ payload: i, settle: () => {} });
    }
    // No queue: all 5 sent at once, indices cycle 0,1,0,1,0.
    expect(t.sends.map((x) => x.index)).toEqual([0, 1, 0, 1, 0]);
    expect(t.maxInFlight).toBe(5);
  });

  test("drain is a no-op (round-robin never queues)", () => {
    const t = fakeTransport(2);
    const s = roundRobin();
    s.bind(t.ctx);
    s.submit({ payload: 1, settle: () => {} });
    expect(() => s.drain()).not.toThrow();
  });
});
