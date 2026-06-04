import { workerPool } from "@ddd-dod/platform";
import { type CpuJob, type CpuResult, runCpuJob } from "./cpu-job";

/**
 * Worker for the **pool arm**. Share-nothing: its own thread + realm. In EPIC-003
 * it will `createContainer()` and bootstrap the real `statements`/`reconciliation`
 * deps here (per the worker+DI demo seed); for the scaffold it just runs the CPU
 * stand-in. Pairs with `createWorkerPool` in `server-pool.ts`.
 */
workerPool.serveWorker<CpuJob, CpuResult>((job) => runCpuJob(job));
