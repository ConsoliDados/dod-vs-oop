import { serveWorker } from "../../worker-pool";

/**
 * Test fixture worker: doubles a number, throws on a negative input (to exercise
 * the `WorkerError` path). Each worker is its own realm — in a real service it
 * would `createContainer()` and bootstrap its own deps here.
 */
serveWorker<number, number>((n) => {
  if (n < 0) {
    throw new Error("negative input");
  }
  return n * 2;
});
