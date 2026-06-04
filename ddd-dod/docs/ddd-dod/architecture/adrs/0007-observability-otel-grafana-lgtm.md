# ADR-0007 — Observability stack: OpenTelemetry + Grafana LGTM

- **Status:** Accepted
- **Date:** 2026-06-03
- **Phase / Sprint:** EPIC-002 (active-foundation) → consumed fully by the observability epic

## Context

The study must observe and measure CPU, memory, latency, and throughput — and, for the DOD-vs-OOP narrative, **where time goes per layer**. That spans three distinct signals: **logs** (events), **metrics** (time-series), **traces** (per-request latency). Constraints:

- **Open-source only** — no Sentry, no Datadog, nothing paid.
- The observability backend runs in **containers separate from the measured process**, so it doesn't influence benchmarks.
- The stack choice must not couple application code to a vendor.

## Decision

**Instrument with OpenTelemetry (OTLP) as the neutral export layer**, and aggregate in the **Grafana LGTM** stack:

| Signal / role | Tool |
|---|---|
| Export / instrumentation | **OpenTelemetry (OTLP)** |
| Ingestion hub | **OTel Collector** |
| Metrics (TSDB) | **Prometheus** |
| Traces | **Tempo** |
| Logs | **Loki** |
| Visualization | **Grafana** |
| Process/container CPU+mem | **cAdvisor + node_exporter** (→ Prometheus) |

For the study/dev backend, use the single all-in-one image **`grafana/otel-lgtm`** (Collector + Prometheus + Tempo + Loki + Grafana in one container) — minimal ops, full stack, runs separate from the app. The app only knows OTLP; the backend is a deployment detail and can be swapped without code changes.

## Scope split

- **This epic (EPIC-002, FEAT-002 logger):** only the **logs** seam — `OtlpLogSink` maps our `LogRecord` to the OTel logs data model and hands it to an injected `OtelLogEmitter`. Selected by `NODE_ENV` (dev → console; production + emitter → OTLP).
- **Observability epic (later):** the real OTel SDK wiring (the `OtelLogEmitter` backed by `@opentelemetry/sdk-logs` + OTLP HTTP exporter), **metrics** and **traces** instrumentation, the `grafana/otel-lgtm` compose, and Grafana dashboards.

## Alternatives considered

- **(a) Paid APM (Datadog / Sentry / New Relic)** — rejected hard: paid, vendor lock-in, and their agents would taint benchmark fairness.
- **(b) Jaeger instead of Tempo** — viable (nice UI; Grafana can query it), but Tempo is Grafana-native, cheaper (object storage), and bundled in `grafana/otel-lgtm`. Tempo chosen for the single-pane goal; Jaeger remains a drop-in alternative.
- **(c) ELK/OpenSearch for logs** — rejected: heavyweight and resource-hungry for a study; Loki ingests our structured JSON directly and is far lighter.
- **(d) No Prometheus (assume OTel "is" metrics)** — rejected: OTel **exports**, it does not **store**; a TSDB is required and Prometheus is the standard.

## Consequences

- **Positive**: one painel correlating trace↔log↔metric; vendor-neutral (swap backend freely); fully OSS / zero cost; traces give the study's "where the architecture spends time" narrative.
- **Negative / caveats**:
  - The OTel SDK adds **in-process overhead** → controlled benchmark runs must run with telemetry **off** (toggled by `NODE_ENV`) or **identical across all three** implementations so it cancels. The **headline numbers stay the harness's** (ADR-0007-class methodology: load tool + cAdvisor/`/proc`); Grafana/OTel is observability + diagnosis, not the benchmark source of truth.
  - **Bun + OTel** auto-instrumentation/runtime-metrics are less mature than Node's → prefer **manual** instrumentation (explicit spans at boundaries, explicit metrics), which is also more fair across implementations.

## References

- `../sad.md` §5 (logging), §8 (future directions)
- ADR-0002 / ADR-0005 — Result + the `@consolidados/results` globals (logger error-as-value)
- FRD-002 (`frd-logger`) — the `OtlpLogSink` seam delivered in FEAT-002
- Editorial: business-vault idea `observabilidade-oss-otel-grafana-lgtm` (the public write-up of this rationale)
