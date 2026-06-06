---
feature: logger
frd: FRD-002
epic: EPIC-002 (active-foundation)
branch: feat/logger
status: done
---

# Feature — logger (FEAT-002)

Live build trail. Spec: [`architecture/frds/frd-logger.md`](../../architecture/frds/frd-logger.md). The code is the Act.

## Tasks (from FRD §5)

- [x] `otlp-log-sink.ts` — `OtelLogData` + `OtelLogEmitter` + `createOtlpLogSink` (severity mapping, never-throws)
- [x] `selectSink({ nodeEnv, otelEmitter? })` — env-based transport strategy
- [x] Export from logger public API; wire `composition-root.ts` to `selectSink`
- [x] Tests: OTLP mapping (severity/attrs/requestId/error/never-throws) + selection behavior

## Notes / surprises

- The scaffold's `LogSink` port already **is** the strategy — FEAT-002 was two additions (an OTLP sink + a selector), not a redesign.
- `OtlpLogSink` delegates to an injected `OtelLogEmitter`, so no OTel SDK dependency lands here — the real exporter is the observability epic (ADR-0007 scope split).
- Verified boot both ways: dev → console **pretty**; `NODE_ENV=production` (no emitter) → console **JSON** one-liner. Prod + emitter would route to OTLP.

## Retro (on close)

- Clean. The strategy seam was already present (the `LogSink` port), so the work was the OTLP **mapping** (LogRecord → OTel logs data model, severity 5/9/13/17) + the env selector + 6 tests. `bun run check` clean; `bun test` 29/29.
