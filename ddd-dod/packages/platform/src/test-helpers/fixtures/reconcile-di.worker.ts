// A runtime entry surface (its own thread/realm), so it registers the results
// globals itself — the bun:test preload does NOT reach into spawned workers.
import "@ddd-dod/types/globals";
import { createContainer, token } from "../../di";
import { serveWorker } from "../../worker-pool";

/**
 * Demo worker: proves the **share-nothing** model end-to-end. Each worker
 * bootstraps its **own** DI container (separate heap — nothing is shared with the
 * main thread or sibling workers), resolves a service through the async
 * container, and runs a small CPU-bound reconcile job. Stand-in for a real
 * `reconciliation`/`statements` worker; not wired into the domain yet.
 */
interface ReconcileBatch {
  readonly pairs: ReadonlyArray<{ readonly internal: number; readonly external: number }>;
}
interface ReconcileSummary {
  readonly matched: number;
  readonly mismatched: number;
  readonly totalDelta: number;
}
interface Reconciler {
  reconcile(batch: ReconcileBatch): ReconcileSummary;
}

const Reconciler = token<Reconciler>("reconciler");

// Per-worker container, wired once when the worker module loads.
const container = createContainer();
container.register(Reconciler, () => ({
  reconcile: ({ pairs }) => {
    let matched = 0;
    let mismatched = 0;
    let totalDelta = 0;
    for (const { internal, external } of pairs) {
      const delta = internal - external;
      if (delta === 0) {
        matched++;
      } else {
        mismatched++;
        totalDelta += Math.abs(delta);
      }
    }
    return { matched, mismatched, totalDelta };
  },
}));

serveWorker<ReconcileBatch, ReconcileSummary>(async (batch) => {
  const svc = (await container.resolve(Reconciler)).unwrap();
  return svc.reconcile(batch);
});
