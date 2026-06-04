import { defineError, type EnumValues } from "@ddd-dod/types";

/**
 * Worker-pool failures (ADR-0004 follow-up). Result-native like the rest of the
 * platform; carries the renderers (ADR-0009). `WorkerError` wraps a failure
 * surfaced from a worker (handler threw, or the worker crashed); `PoolDisposed`
 * is a `run()` after `dispose()`.
 */
const variants = {
  workerError: (message: string) => ({ WorkerError: { message } }) as const,
  poolDisposed: () => "PoolDisposed" as const,
} as const;

export type WorkerPoolError = EnumValues<typeof variants>;

export const WorkerPoolError = defineError(variants, {
  format: (e: WorkerPoolError) =>
    match(e, {
      WorkerError: (x) => `worker error: ${x.message}`,
      PoolDisposed: () => "worker pool has been disposed",
    }),
  serialize: (e: WorkerPoolError) =>
    match(e, {
      WorkerError: (x) => ({ kind: "WorkerError", message: x.message }),
      PoolDisposed: () => ({ kind: "PoolDisposed" }),
    }),
});
