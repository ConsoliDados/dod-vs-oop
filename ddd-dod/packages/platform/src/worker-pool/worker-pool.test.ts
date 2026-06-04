import { describe, expect, test } from "bun:test";
import { createWorkerPool } from "./index";

const workerUrl = new URL("../test-helpers/fixtures/double.worker.ts", import.meta.url);

describe("worker-pool — real Bun workers", () => {
  test("dispatches tasks across workers and returns Ok results", async () => {
    const pool = createWorkerPool<number, number>({ size: 2, worker: workerUrl });
    try {
      const results = await Promise.all([1, 2, 3, 4, 5].map((n) => pool.run(n)));
      expect(results.map((r) => r.unwrap())).toEqual([2, 4, 6, 8, 10]);
    } finally {
      await pool.dispose();
    }
  });

  test("a throwing handler surfaces as Err(WorkerError), never crashes the pool", async () => {
    const pool = createWorkerPool<number, number>({ size: 1, worker: workerUrl });
    try {
      const bad = await pool.run(-1);
      expect(bad.unwrapErr()).toHaveProperty("WorkerError");
      // pool still works afterwards
      expect((await pool.run(3)).unwrap()).toBe(6);
    } finally {
      await pool.dispose();
    }
  });

  test("run after dispose is Err(PoolDisposed)", async () => {
    const pool = createWorkerPool<number, number>({ size: 1, worker: workerUrl });
    await pool.dispose();
    expect((await pool.run(1)).unwrapErr()).toBe("PoolDisposed");
  });
});
