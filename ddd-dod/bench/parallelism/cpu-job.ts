/**
 * CPU-bound **stand-in** for the real Phase-3 jobs — `statements` generation
 * (~10k postings) and `reconciliation` matching (~50k×50k) — which land in
 * EPIC-003. Deterministic and **size-parametrized** so both bench arms compute
 * the *same* work and the k6 sweep can scale load (payload size drives the
 * structured-clone crossover).
 *
 * **This is the only thing to swap when EPIC-003 ships:** point the inline arm,
 * the worker, and the k6 size knob at the real domain function. The servers and
 * the worker depend on this signature, nothing else.
 */
export interface CpuJob {
  /** Work size — stands in for "postings in a statement" / "entries to reconcile". */
  readonly size: number;
  /** Seed so runs are reproducible across arms. */
  readonly seed?: number;
}

export interface CpuResult {
  readonly size: number;
  readonly checksum: number;
}

/**
 * A reconcile-flavored loop: deterministic (LCG, no RNG), allocation-light, O(size)
 * — pure CPU, nothing async, so it genuinely blocks the event loop in the inline
 * arm. Same input ⇒ same `checksum`, which the conformance gate can assert.
 */
export function runCpuJob({ size, seed = 1 }: CpuJob): CpuResult {
  let checksum = 0;
  let acc = seed >>> 0;
  for (let i = 0; i < size; i++) {
    acc = (acc * 1664525 + 1013904223) >>> 0; // LCG step — cheap, deterministic
    const internal = acc % 1000;
    const external = (acc >>> 7) % 1000;
    checksum = (checksum + Math.abs(internal - external)) >>> 0;
  }
  return { size, checksum };
}
