import { Elysia } from "elysia";
import { runCpuJob } from "./cpu-job";

/**
 * **Inline arm** (baseline). The CPU stand-in runs *on the event loop*, inside the
 * request handler. Under concurrent load this **blocks** the loop — so the cheap
 * `/ping` endpoint's tail latency should balloon (head-of-line blocking). That is
 * exactly what the pool arm (`server-pool.ts`) is measured against.
 *
 * Run ONE arm at a time (a server should own the cores during measurement):
 *   PORT=3333 bun run bench/parallelism/server-inline.ts
 *
 * Stand-in CPU job until EPIC-003 (see `cpu-job.ts`).
 */
const PORT = Number(process.env.PORT ?? 3333);

new Elysia()
  .get("/ping", () => ({ ok: true })) // cheap canary — its p99 is the headline
  .get("/cpu", ({ query }) => runCpuJob({ size: Number(query.size ?? 50_000) }))
  .listen(PORT, () => console.log(`[inline] listening on ${PORT}`));
