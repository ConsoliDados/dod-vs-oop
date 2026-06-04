import { WorkerPoolError } from "./errors";

/**
 * A scheduled unit of work: an opaque payload plus its settler. The pool builds
 * one of these per `run()` and hands it to the active {@link DispatchStrategy};
 * the strategy decides **which** worker runs it and **when**.
 */
export interface PendingTask {
  readonly payload: unknown;
  /** Resolve the caller's `run()` promise. Called exactly once. */
  settle(result: Result<unknown, WorkerPoolError>): void;
}

/**
 * The transport a strategy schedules onto, injected by the pool via
 * {@link DispatchStrategy.bind}. The strategy never touches `Worker`/`postMessage`
 * — it only picks a worker index and awaits the reply, keeping scheduling policy
 * independent of the thread runtime.
 */
export interface DispatchContext {
  /** Number of workers in the pool (valid indices `0..size-1`). */
  readonly size: number;
  /** Run `payload` on worker `index`; resolves when that worker replies. Never rejects. */
  send(index: number, payload: unknown): Promise<Result<unknown, WorkerPoolError>>;
}

/**
 * Pluggable scheduling policy for a {@link WorkerPool} — the **comparison axis**
 * of the parallelism study (ADR-0013). The pool owns transport + reply
 * correlation; the strategy owns *when/where* each task runs. Swap it to measure
 * dispatch policies under the same workload.
 *
 * Shipped: {@link fifoBackpressure} (default — CPU-bound jobs) and
 * {@link roundRobin} (the naive baseline). New policies (e.g. `leastLoaded`)
 * implement this interface without touching the pool.
 */
export interface DispatchStrategy {
  /** Bind to the pool's transport. Called once, at pool creation. */
  bind(ctx: DispatchContext): void;
  /** Schedule a task. The strategy decides the worker and the timing. */
  submit(task: PendingTask): void;
  /** Pool is disposing: settle every still-**queued** (not-yet-sent) task as `Err(PoolDisposed)`. */
  drain(): void;
}

/**
 * **Round-robin, unbounded in-flight** — the original pool behavior (ADR-0011).
 * Sends task *k* to worker *k mod size* with no regard for load, so a heavy job
 * can sit behind it while a sibling idles. Kept as the naive **baseline** the
 * study measures {@link fifoBackpressure} against. Never queues, so `drain` is a
 * no-op.
 */
export function roundRobin(): DispatchStrategy {
  let ctx: DispatchContext | undefined;
  let next = 0;
  return {
    bind(c) {
      ctx = c;
    },
    submit(task) {
      const c = ctx as DispatchContext;
      const index = next % c.size;
      next++;
      c.send(index, task.payload).then(task.settle);
    },
    drain() {},
  };
}

/**
 * **FIFO + backpressure** — at most **one in-flight job per worker** (each job
 * saturates a thread, so a second would only serialize behind it on that
 * worker's loop), with surplus tasks held in a **FIFO queue** and pulled as
 * workers free up. The correct policy for CPU-bound jobs
 * (`statements`/`reconciliation`) and the pool's **default** (ADR-0013). `drain`
 * rejects everything still queued.
 */
export function fifoBackpressure(): DispatchStrategy {
  let ctx: DispatchContext | undefined;
  const idle: number[] = [];
  const queue: PendingTask[] = [];

  function pump() {
    const c = ctx as DispatchContext;
    while (idle.length > 0 && queue.length > 0) {
      const index = idle.shift() as number;
      const task = queue.shift() as PendingTask;
      c.send(index, task.payload).then((result) => {
        task.settle(result);
        idle.push(index); // worker free again — pull the next queued task
        pump();
      });
    }
  }

  return {
    bind(c) {
      ctx = c;
      for (let i = 0; i < c.size; i++) {
        idle.push(i);
      }
    },
    submit(task) {
      queue.push(task);
      pump();
    },
    drain() {
      while (queue.length > 0) {
        (queue.shift() as PendingTask).settle(Err(WorkerPoolError.poolDisposed()));
      }
    },
  };
}
