---
feature: app-bootstrap
frd: FRD-004
epic: EPIC-002 (active-foundation)
branch: feat/app-bootstrap
status: done
---

# Feature — app-bootstrap (FEAT-004)

Live build trail. Spec: [`architecture/frds/frd-app-bootstrap.md`](../../../../architecture/frds/frd-app-bootstrap.md). Reference: my-approfile `services/auth` (`bootstrap.ts` + `main.ts`). The code is the Act.

## Tasks (from FRD §5)

- [x] `container.ts` — `onDispose(fn)` (teardown callbacks; reverse order)
- [x] `composition-root.ts` — eager sink/logger/db + `onDispose` (sink flush+dispose, db close)
- [x] `bootstrap.ts` — `bootstrap()` + `Bootstrapped` + `BootstrapError` + `formatBootstrapError`
- [x] `main.ts` — `match(bootstrap()) → listen + graceful SIGTERM/SIGINT`
- [x] Tests: container onDispose order · bootstrap Ok/Err(Config) · `/health` · dispose no-throw

## Notes / surprises

- Mirrors `services/auth` shape, but teardown goes through **`container.dispose()`** (ours; auto reverse-order) instead of the reference's manual `dispose` composition; and `bootstrap` is **sync** (sqlite `:memory:`, no async resource).
- `onDispose(fn)` generalized the container's disposables list to teardown callbacks (a resolved `Disposable` registers `() => instance.dispose()`); the sink flush+dispose and db close are wired as `onDispose` callbacks in the composition root.
- `bootstrap` needs no `Result` casts — `Bootstrapped`/`BootstrapError` are concrete (the `OkType`/`ErrType` reduction only bites naked generics, as in `tryAsync`/`resolve`).

## Retro (on close)

- The never-throw loop is closed: smoke-verified `api listening` → SIGTERM → `shutting down {signal}` → dispose (flush sink + close db) → exit 0. `bun run check` clean; `bun test` 36/36. This is the piece NestJS hands over for free, built explicitly — and it reads cleanly.
