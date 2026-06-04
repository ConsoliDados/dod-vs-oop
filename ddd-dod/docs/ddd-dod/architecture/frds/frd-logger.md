---
id: FRD-002
slug: logger
sdd: null
feature: logger
epic_ref: EPIC-002 (active-foundation)
status: done
---

# FRD-002 — logger

> **Infra feature** (no parent SDD). Extends the scaffold's functional logger with an **environment-selected transport**: terminal in dev, OTLP (→ observability stack) in production.

## 1. Intent

The scaffold already ships a functional logger (factory `createLogger`, immutable `child`, level filtering, key redaction, `ConsoleSink`). FEAT-002 adds the **strategy seam** the runtime needs: pick the `LogSink` by `NODE_ENV`, and provide an **`OtlpLogSink`** that maps our `LogRecord` to the OpenTelemetry logs data model so logs can flow to the observability stack (ADR-0007) — without dragging the OTel SDK into this package.

## 2. Inherited context (upstream refs)

- **ADR-0007** — observability stack: OTel (OTLP) as the neutral export layer → Grafana LGTM. This feature delivers only the **logs seam**; metrics/traces and the real OTel SDK wiring are the observability epic.
- **SAD §5** — logging is structured JSON, at boundaries, never inside pure domain functions.
- The existing `LogSink` port **is** the strategy — no redesign, just two new pieces (an OTLP sink + a selector).

## 3. Acceptance criteria

- [x] `selectSink({ nodeEnv, otelEmitter? })` returns a `LogSink`: `development` → console **pretty**; `test`/`production` without emitter → console **json**; `production` **with** an `otelEmitter` → `OtlpLogSink`.
- [x] `createOtlpLogSink(emitter)` maps each `LogRecord` to an `OtelLogData` and calls `emitter.emit` — never throws (guards the emitter).
- [x] Severity mapping: `debug→5`, `info→9`, `warn→13`, `error→17` (OTel severityNumber + text).
- [x] Attributes carry `context`, the structured `fields`, `requestId` (when present), and flattened `error.{name,message,stack}` (when present); `body` = the message.
- [x] The `apps/api` composition root builds its logger via `selectSink` (so prod is OTLP-ready; the emitter is injected by the observability epic).
- [x] Existing logger behavior (levels, redaction, `child`) is unchanged; all prior logger tests still pass.

## 4. Validation / mapping rules

| `LogRecord` | → `OtelLogData` |
|---|---|
| `time` (ISO) | `timeUnixNano` (`Date.parse(time) * 1_000_000`) |
| `level` | `severityNumber` + `severityText` (table above) |
| `message` | `body` |
| `context`, `requestId`, `fields`, `err` | `attributes` (`err` flattened to `error.*`) |

- The OTLP sink depends on an injected **`OtelLogEmitter`** port (`emit(OtelLogData): void`) — the observability epic implements it with `@opentelemetry/sdk-logs` + an OTLP HTTP exporter → Collector. No OTel package dependency is added in this feature.

## 5. Tasks (1–2 day units)

1. `otlp-log-sink.ts` — `OtelLogData` + `OtelLogEmitter` types, severity mapping, `createOtlpLogSink(emitter)` (never-throws).
2. `selectSink({ nodeEnv, otelEmitter? })` — the env-based strategy.
3. Export both from the logger public API; wire `composition-root.ts` to use `selectSink`.
4. Tests: OTLP mapping (severity, attributes, requestId, error flatten, never-throws) + selection behavior (prod+emitter routes to OTLP; prod without emitter does not).

## 6. Behavioral API surface

```ts
createOtlpLogSink(emitter: OtelLogEmitter): LogSink
selectSink(opts: { nodeEnv: "development" | "test" | "production"; otelEmitter?: OtelLogEmitter }): LogSink
interface OtelLogEmitter { emit(record: OtelLogData): void }
interface OtelLogData { timeUnixNano; severityNumber; severityText; body; attributes }
```

## 7. Out of scope

- The real OTel SDK wiring (`OtelLogEmitter` impl), metrics, traces, the `grafana/otel-lgtm` compose, dashboards → **observability epic** (ADR-0007 scope split).
- Request-id middleware / per-request `child` wiring → FEAT-005 (http-app), where the HTTP layer lives.

## 8. Open questions

- Fan-out (console **and** OTLP simultaneously in prod) — deferred; `NODE_ENV` picks one transport for now. Revisit if prod wants stdout JSON + OTLP together.
