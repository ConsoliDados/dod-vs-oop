import { describe, expect, test } from "bun:test";
import { createWorkerPool } from "../src/worker-pool";

/**
 * Integration demo (crosses worker-pool + DI + the results globals, across real
 * Bun threads): a pool of workers, **each bootstrapping its own DI container**,
 * resolving a service asynchronously and running a CPU-bound reconcile job. This
 * is the share-nothing story end-to-end — no container/state is shared across
 * threads. Lives on the `demo/worker-di-pool` branch (not wired into the domain).
 */
type ReconcileBatch = { pairs: Array<{ internal: number; external: number }> };
type ReconcileSummary = { matched: number; mismatched: number; totalDelta: number };

const workerUrl = new URL("../src/test-helpers/fixtures/reconcile-di.worker.ts", import.meta.url);

describe("worker + DI end-to-end (share-nothing)", () => {
  test("each worker bootstraps its own container and runs the reconcile job", async () => {
    const pool = createWorkerPool<ReconcileBatch, ReconcileSummary>({
      size: 3,
      worker: workerUrl,
    });
    try {
      const batches: ReconcileBatch[] = [
        {
          pairs: [
            { internal: 100, external: 100 },
            { internal: 50, external: 55 },
          ],
        },
        { pairs: [{ internal: 10, external: 10 }] },
        {
          pairs: [
            { internal: 7, external: 9 },
            { internal: 3, external: 3 },
          ],
        },
        {
          pairs: [
            { internal: 1, external: 1 },
            { internal: 2, external: 2 },
          ],
        }, // 4th task -> reuses a worker
      ];
      const summaries = (await Promise.all(batches.map((b) => pool.run(b)))).map((r) => r.unwrap());

      expect(summaries[0]).toEqual({ matched: 1, mismatched: 1, totalDelta: 5 });
      expect(summaries[1]).toEqual({ matched: 1, mismatched: 0, totalDelta: 0 });
      expect(summaries[2]).toEqual({ matched: 1, mismatched: 1, totalDelta: 2 });
      expect(summaries[3]).toEqual({ matched: 2, mismatched: 0, totalDelta: 0 });
    } finally {
      await pool.dispose();
    }
  });
});
