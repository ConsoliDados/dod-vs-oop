---
slug: di-container
sdd: null
feature: di-container
epic_ref: EPIC-002 (active-foundation)
status: done
---

# FRD — di-container

> **Infra feature** (no parent SDD). Hardens the scaffold's DI container into a **Result-native, never-throwing, disposable** container — built to be **reused across projects** (candidate for the shared template). Amends **ADR-0004**.

## 1. Intent

The scaffold shipped a minimal functional container (`register`/`registerValue`/`resolve`/`has`, singleton-by-default, `resolve` **threw** on missing/circular). This feature brings it to a production bar — better than the `conecta` reference (class-based static singleton with a throwing `get`) — while keeping it **functional (no class)** and aligned with the project's discipline:

- **Never throws.** `resolve` returns `Result<T, DiError>`. The bootstrap captures `Err` and shuts down gracefully (FEAT-004) — no fail-fast crash.
- **Lifecycle.** Tracks `Disposable` singletons and `dispose()`s them in reverse creation order (the seam graceful shutdown uses).
- **Reusable.** Generic, no `ddd-dod` coupling.

## 2. Inherited context (upstream refs)

- **ADR-0004 (amended 2026-06-04)** — token-based container, composition-root-only, **Result-native / never-throws**, disposable, reusable; not the class/static-singleton `conecta` style; no decorators.
- **ADR-0002** — error-as-value; this extends it to the wiring layer.
- `conecta` DI (reference, by name): folder-organized + beefier (singleton+transient, dispose, structured `DependencyError`, circular detection) **but** built around a `class` static singleton + Bun-Worker serialize — we take the good parts functionally, drop the rest.

## 3. Acceptance criteria

- [x] `resolve<T>(token)` returns `Result<T, DiError>` and **never throws** — `Err(NotRegistered)` (no provider), `Err(CircularDependency)` (cycle, with the chain), `Err(FactoryFailed)` (a factory threw).
- [x] `DiError` is a typed Rust-enum-style union with a `formatDiError` (matched via the global `match`).
- [x] Lifetimes: `singleton` (default, memoized lazily) and `transient` (new instance per resolve).
- [x] `dispose(): Promise<void>` disposes tracked `Disposable` singletons in **reverse creation order**, **swallowing + logging** per-item failures (never throws); clears state.
- [x] Typed `Token<T>` (unique `Symbol`); `register` / `registerValue` / `has` unchanged in spirit.
- [x] No `class`, no static singleton, no decorators, no Worker serialize.
- [x] Composition root + `main.ts` thread the resolve `Result` (handled via `match`); no throw anywhere.

## 4. API surface

```ts
token<T>(description: string): Token<T>
createContainer(): Container

interface Container {
  register<T>(token: Token<T>, factory: (c: Container) => T, opts?: { lifetime?: "singleton" | "transient" }): void
  registerValue<T>(token: Token<T>, value: T): void
  resolve<T>(token: Token<T>): Result<T, DiError>      // never throws
  has(token: Token<unknown>): boolean
  dispose(): Promise<void>                              // reverse order, swallow+log
}

interface Disposable { dispose(): void | Promise<void> }
type DiError = { NotRegistered: {...} } | { CircularDependency: {...} } | { FactoryFailed: {...} }
formatDiError(e: DiError): string
```

## 5. Tasks (1–2 day units)

1. `di/errors.ts` — `DiError` union + factory + `formatDiError`.
2. `di/container.ts` — rewrite: Result-native `resolve` (never-throws; circular + factory-fail → `Err`), `singleton`/`transient`, `Disposable` tracking + `dispose` (reverse order, swallow+log).
3. `di/index.ts` — export the additions.
4. Thread the resolve `Result` through `composition-root.ts` / `app.ts` / `main.ts` (resolve handled via `match`; on `Err` log + exit — graceful dispose comes in FEAT-004).
5. Tests: resolve Ok/Err (NotRegistered/Circular/FactoryFailed), singleton memoization, transient freshness, `dispose` order + swallow, `registerValue`.

## 6. Out of scope

- Graceful shutdown wiring (SIGTERM → `dispose` → exit) and making `db`/logger sinks `Disposable` → **FEAT-004 (app-bootstrap)**.
- Child / request-scoped containers — not needed (per-request correlation is `logger.child()`).
- Bun-Worker serialize/hydrate, module registry, decorators — out (ADR-0004 anti-gold-plating).

## 7. Open questions

- Extraction to the shared template (`project_templates`) once proven — tracked in `open-questions.md` OQ-001.
