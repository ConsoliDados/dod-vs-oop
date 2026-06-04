---
feature: config
frd: FRD-001
epic: EPIC-002 (active-foundation)
branch: feat/config
status: done
---

# Feature — config (FEAT-001)

Live build trail. Spec: [`architecture/frds/frd-config.md`](../../../../architecture/frds/frd-config.md). The code is the Act — no separate `act.md`.

## Tasks (from FRD §5)

- [x] Harden Zod schema + immutable `AppConfig` (`Object.freeze`)
- [x] `formatConfigError(e)` — one line per Zod issue
- [x] Export `loadConfig` / `formatConfigError` / `AppConfig` / `ConfigError`
- [x] Wire `main.ts` to log `formatConfigError` on the `Err` branch
- [x] Tests: happy · defaults · invalid PORT · invalid LOG_LEVEL · unknown-key stripping · formatConfigError

## Notes / surprises

- Env schema stays non-`.strict()` on purpose (ADR-0006): `process.env` carries unrelated keys, so unknown keys are stripped, not rejected.
- `AppConfig` is `Readonly<…>` + `Object.freeze` — immutable in type and at runtime.

## Retro (on close)

- Smooth; config was already 80% there from the scaffold. The "for real" delta was `formatConfigError` (legible boot failure) + freezing + the negative-path tests. `bun test` 23/23; boot prints a clean per-issue error on bad `PORT` and exits 1.
