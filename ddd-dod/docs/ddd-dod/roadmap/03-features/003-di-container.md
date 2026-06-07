---
feature: di-container
frd: di-container
epic: EPIC-002 (active-foundation)
branch: feat/di-container
status: done
---

# Feature — di-container (FEAT-003)

Live build trail. Spec: [`architecture/frds/frd-di-container.md`](../../architecture/frds/frd-di-container.md). The code is the Act.

## Tasks (from FRD §5)

- [x] `di/errors.ts` — `DiError` union + `formatDiError`
- [x] `di/container.ts` — Result-native `resolve` (never throws) + `singleton`/`transient` + `dispose` (reverse order, swallow+log)
- [x] `di/index.ts` — exports
- [x] Thread the resolve `Result` through composition-root / app / main (via `match`)
- [x] Tests: Ok/Err (NotRegistered/Circular/FactoryFailed) · singleton · transient · dispose order+swallow

## Notes / surprises

- Directive (2026-06-04): reusable across projects + **never throw** (superseded ADR-0004's fail-fast); better than `conecta` but functional (no class/static singleton).
- `app.ts` now takes **resolved deps** (`{ config }`), not the container — the app no longer touches the container (only the composition root does). `main.ts` threads the resolve `Result` via nested `match`.
- A dependency **cycle** surfaces as an `Err` (no throw, no hang): the inner `CircularDependency` is wrapped by the outer factory's `FactoryFailed` because factories `unwrap`; the guarantee that matters (never throws, returns `Err`) holds.
- Graceful shutdown (SIGTERM → `dispose`) + making db/logger `Disposable` are **FEAT-004** — here we shipped the `dispose` mechanism + Result-native resolve only.

## Retro (on close)

- The `Result<T, DiError>` casts in `resolve` are the same lib-typing bridge as `tryAsync` (`OkType`/`ErrType` don't reduce over a naked generic) — documented, localized. Otherwise clean. `bun run check` clean; `bun test` 33/33; boot dev OK.
