import { check } from "k6";
import http from "k6/http";
import { Trend } from "k6/metrics";

/**
 * Mixed-load scenario for the **parallelism axis** (ADR-0013; examples-root
 * BENCHMARKS.md "Extra — parallelism"). Two endpoints hammered concurrently:
 *   /cpu   — the CPU-bound stand-in (statements/reconciliation in EPIC-003)
 *   /ping  — the cheap canary; its p99 is the HEADLINE (head-of-line blocking)
 *
 * Run the SAME script against each arm SEPARATELY (one server owns the cores):
 *   PORT=3333 bun run bench/parallelism/server-inline.ts          # arm A
 *   PORT=3333 BENCH_WORKERS=8 bun run bench/parallelism/server-pool.ts   # arm B
 *   k6 run -e BASE_URL=http://localhost:3333 bench/parallelism/load.k6.js
 *
 * Sweeps: CPU_SIZE (payload → clone crossover), BENCH_WORKERS (scaling knee),
 * BENCH_DISPATCH (fifo-backpressure vs round-robin).
 */
const BASE_URL = __ENV.BASE_URL || "http://localhost:3333";
const CPU_SIZE = __ENV.CPU_SIZE || "50000";

// The canary: cheap-endpoint latency measured *while* the CPU load runs.
const pingLatency = new Trend("ping_latency_ms", true);

export const options = {
  scenarios: {
    cpu_load: {
      executor: "ramping-vus",
      exec: "cpu",
      startVUs: 0,
      stages: [
        { duration: "15s", target: 20 },
        { duration: "30s", target: 50 },
        { duration: "15s", target: 0 },
      ],
    },
    ping_canary: {
      executor: "constant-vus",
      exec: "ping",
      vus: 2,
      duration: "60s",
    },
  },
  thresholds: {
    // Headline: the cheap endpoint must stay responsive even under CPU load.
    // Inline arm is expected to BLOW this; pool arm to hold it. That delta is the finding.
    ping_latency_ms: ["p(99)<50"],
    "http_req_failed{scenario:cpu_load}": ["rate<0.01"],
  },
};

export function cpu() {
  http.get(`${BASE_URL}/cpu?size=${CPU_SIZE}`);
}

export function ping() {
  const res = http.get(`${BASE_URL}/ping`);
  pingLatency.add(res.timings.duration);
  check(res, { "ping 200": (r) => r.status === 200 });
}
