# ADR-0005 — `@consolidados/results` via globals

- **Status:** Accepted
- **Date:** 2026-06-03
- **Phase / Sprint:** 0 (bootstrap)

## Context

ADR-0002 commits to error-as-value. The concrete `Result`/`Option` library is the author's own [`@consolidados/results`](https://github.com/consolidados/results). It exposes `Ok`, `Err`, `Some`, `None`, and `match` as **ambient globals** so no per-file import of the combinators is needed. Its `./globals` types-only entry declares the *value* globals but **not** the `Result`/`Option` *type* aliases; the library's "Monorepo Setup" docs (and the author's `my-approfile` repo) recommend a **dedicated wrapper package** that owns the wiring once and bridges the missing type aliases.

## Decision

Pin **`@consolidados/results@^0.5.0`** in a single wrapper package, **`@ddd-dod/types`** (`packages/types`), mirroring the library's recommended monorepo pattern. The wrapper exposes two subpaths:

- `./globals` → `import "@consolidados/results"` (registers the runtime value-globals).
- `./globals-types` → an ambient `.d.ts` that `/// <reference>`s `@consolidados/results/globals` (the value globals) **and** bridges the type aliases: `declare global { type Result<T,E> = ...; type Option<T> = ... }`.

Consumers depend on `@ddd-dod/types` (not on `@consolidados/results` directly). Wiring:

- **Runtime values**: `import "@ddd-dod/types/globals"` once per entry surface — `apps/api/src/main.ts` and the `bun:test` preload (`bunfig.toml` → `test-setup.ts`). Never in a domain/library module.
- **Ambient types**: each `tsconfig.json` adds `packages/types/src/globals-types.d.ts` to its `include` (the root tsconfig picks it up via the `packages/**` glob; per-package tsconfigs add it by relative path).

> **Wiring nuance (discovered at bootstrap).** The library docs put `@<wrapper>/globals-types` in `compilerOptions.types`. That relies on TS resolving the wrapper subpath as a *type-reference directive*, which fails under **Bun's isolated `node_modules` layout** (workspace packages aren't surfaced under `node_modules/@scope/`, so the directive doesn't resolve — though normal module imports of the same package do). We therefore wire the ambient `.d.ts` via tsconfig **`include`** instead of the `types` array. Same effect (`declare global` + the `/// <reference>` apply program-wide), Bun-compatible.

Usage conventions (verified against the installed `^0.5.0` typings — no API change needed):
- `Result<T, E>` (ambient) for fallible returns; `Ok(...)` / `Err(...)` to construct (`E` is unconstrained — plain string/object unions, no `extends Error`).
- `match(result, { Ok, Err })` for the single use-case-flow branch; `match(value, handlers, "kind")` for discriminating non-`Result` unions on a key.
- `.isErr()` / `.value()` only in imperative runner/boundary code, never in a use-case body.

## Alternatives considered

- **(a) Direct dep + `types: ["@consolidados/results/globals"]` in every package + `import "@consolidados/results"` scattered** — the bootstrap's first cut; rejected: repeats wiring, pins the version in many places, and never delivers the `Result`/`Option` *type* globals (only the values). The wrapper centralizes all of it.
- **(b) `compilerOptions.types: ["@ddd-dod/types/globals-types"]` (the docs' literal form)** — rejected here: doesn't resolve under Bun's isolated layout (see nuance above). Replaced by the `include` form.
- **(c) neverthrow / hand-rolled `Result`** — rejected: the study uses the author's library by design.

## Consequences

- **Positive**: terse call sites; `Result`/`Option` + `Ok`/`Err`/`Some`/`None`/`match` ambient everywhere with zero per-file imports; one version pin; consistent with the author's `my-approfile` monorepo.
- **Negative**: ambient globals can surprise readers unfamiliar with the lib (documented here, in the project `playbook-ts`, and the root `AGENTS.md`); the `include`-by-relative-path wiring is a Bun-specific deviation from the library's documented `types`-array form (noted above so it isn't mistaken for an error).

## References

- `../sad.md` §5 — error handling
- ADR-0002 — Result + Notification (no throw)
- https://github.com/consolidados/results
- memory `reference_resulst`
