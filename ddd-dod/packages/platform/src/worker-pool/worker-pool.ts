import { WorkerPoolError } from "./errors";

/**
 * A minimal **share-nothing** worker pool (ADR-0004 follow-up). Deliberately
 * **separate from the DI container** — the container must not know about
 * `Worker`/`postMessage`; this is the orchestration layer on top. Each worker is
 * its own thread + realm: it bootstraps **its own** container/state (no shared
 * JS heap), and the pool only round-robins payloads to them and correlates the
 * replies. Result-native: `run` never throws, returning `Err(WorkerPoolError)`.
 *
 * Worker side: implement the worker script with {@link serveWorker}.
 */
export interface WorkerPoolOptions {
  /** Number of workers to spawn (min 1). */
  size: number;
  /** Module URL/path of the worker script (e.g. `new URL("./x.worker.ts", import.meta.url)`). */
  worker: string | URL;
}

export interface WorkerPool<P, R> {
  /** Dispatch a payload to the next worker; resolves with its `Result`. */
  run(payload: P): Promise<Result<R, WorkerPoolError>>;
  /** Terminate every worker; in-flight + later `run`s resolve to `Err(PoolDisposed)`. */
  dispose(): Promise<void>;
}

interface Slot {
  worker: Worker;
  pending: Map<number, (r: Result<unknown, WorkerPoolError>) => void>;
}

interface Reply {
  id: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export function createWorkerPool<P, R>(options: WorkerPoolOptions): WorkerPool<P, R> {
  const slots: Slot[] = [];

  for (let i = 0; i < Math.max(1, options.size); i++) {
    const worker = new Worker(options.worker, { type: "module" });
    const slot: Slot = { worker, pending: new Map() };

    worker.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as Reply;
      const resolve = slot.pending.get(msg.id);
      if (!resolve) {
        return;
      }
      slot.pending.delete(msg.id);
      resolve(
        msg.ok
          ? (Ok(msg.result) as Result<unknown, WorkerPoolError>)
          : Err(WorkerPoolError.workerError(msg.error ?? "unknown worker error")),
      );
    };

    worker.onerror = (ev: ErrorEvent) => {
      // Catastrophic worker-level failure: fail everything in-flight on this slot.
      const message = ev.message || "worker crashed";
      for (const [id, resolve] of slot.pending) {
        slot.pending.delete(id);
        resolve(Err(WorkerPoolError.workerError(message)));
      }
    };

    slots.push(slot);
  }

  let nextId = 0;
  let roundRobin = 0;
  let disposed = false;

  return {
    run(payload) {
      if (disposed) {
        return Promise.resolve(Err(WorkerPoolError.poolDisposed()));
      }
      const slot = slots[roundRobin % slots.length] as Slot;
      roundRobin++;
      const id = nextId++;
      return new Promise<Result<R, WorkerPoolError>>((resolve) => {
        slot.pending.set(id, resolve as (r: Result<unknown, WorkerPoolError>) => void);
        slot.worker.postMessage({ id, payload });
      });
    },

    async dispose() {
      disposed = true;
      for (const slot of slots) {
        slot.worker.terminate();
        for (const [, resolve] of slot.pending) {
          resolve(Err(WorkerPoolError.poolDisposed()));
        }
        slot.pending.clear();
      }
    },
  };
}

/** Minimal shape of the worker global scope this module relies on. */
interface WorkerScope {
  onmessage: ((ev: MessageEvent) => void) | null;
  postMessage: (message: unknown) => void;
}

/**
 * Worker-side counterpart of {@link createWorkerPool}: wire a request/reply loop
 * around `handler`. Place this at the top of the worker module. The handler
 * receives the payload and returns the result (sync or async); a throw becomes
 * `Err(WorkerError)` on the pool side — it never crashes the worker.
 */
export function serveWorker<P, R>(handler: (payload: P) => R | Promise<R>): void {
  const scope = self as unknown as WorkerScope;
  scope.onmessage = async (ev: MessageEvent) => {
    const { id, payload } = ev.data as { id: number; payload: P };
    try {
      const result = await handler(payload);
      scope.postMessage({ id, ok: true, result });
    } catch (err) {
      scope.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  };
}
