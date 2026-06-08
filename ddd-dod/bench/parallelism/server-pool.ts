import "@ddd-dod/types/globals"; // entry surface — register the results globals (for `match`)
import { workerPool } from "@ddd-dod/platform";
import { Elysia } from "elysia";
import type { CpuJob, CpuResult } from "./cpu-job";

/**
 * **Pool arm**. The CPU stand-in is offloaded to a share-nothing worker-pool
 * (default `fifoBackpressure` — one in-flight job per worker + FIFO queue,
 * ADR-0013), so the event loop stays free for I/O: `/ping` should keep its tail
 * latency flat while `/cpu` saturates the workers.
 *
 * Knobs (the study sweeps):
 *   BENCH_WORKERS   N workers           → scaling knee
 *   BENCH_DISPATCH  fifo-backpressure | round-robin → dispatch comparison (ADR-0013)
 *   (k6 `size`)     payload size        → structured-clone crossover
 *
 *   PORT=3333 BENCH_WORKERS=8 bun run bench/parallelism/server-pool.ts
 *
 * Stand-in CPU job + share-nothing bootstrap until EPIC-003 (see `cpu-job.ts`).
 */
const PORT = Number(process.env.PORT ?? 3333);
const WORKERS = Number(process.env.BENCH_WORKERS ?? navigator.hardwareConcurrency ?? 4);
const DISPATCH = process.env.BENCH_DISPATCH ?? "fifo-backpressure";

const pool = workerPool.createWorkerPool<CpuJob, CpuResult>({
  size: WORKERS,
  worker: new URL("./cpu.worker.ts", import.meta.url),
  // Default is fifoBackpressure(); opt into the naive baseline to compare.
  ...(DISPATCH === "round-robin" ? { dispatch: workerPool.roundRobin() } : {}),
});

new Elysia()
  .get("/ping", () => ({ ok: true }))
  .get("/cpu", async ({ query, set }) => {
    const result = await pool.run({ size: Number(query.size ?? 50_000) });
    return match(result, {
      Ok: (r) => r,
      Err: (e) => {
        set.status = 500;
        return { error: workerPool.WorkerPoolError.format(e) };
      },
    });
  })
  .listen(PORT, () => console.log(`[pool] listening on ${PORT} — ${WORKERS} workers, dispatch=${DISPATCH}`));

const shutdown = () => void pool.dispose();
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
