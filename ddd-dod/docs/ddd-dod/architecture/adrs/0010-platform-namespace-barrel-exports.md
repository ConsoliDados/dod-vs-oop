# ADR-0010 — Platform module surface: ESM namespace barrels

- **Status:** Accepted
- **Date:** 2026-06-04
- **Milestone / Sprint:** EPIC-002 (active-foundation) — `feat/platform-conventions`

## Context

`@ddd-dod/platform` re-exported every submodule flat (`export * from "./config"`, …), so the package surface was a long list of loose free functions (`loadConfig`, `createLogger`, `createContainer`, `token`, `selectSink`, …). For an agent-first codebase (AGENTS.md: small context window, distinctive names) it was hard to see *what a module owns* at a glance, and a consumer could pull any single function by name with no signal of which module it belongs to.

## Decision

We will expose each platform submodule as an **ESM namespace barrel** — `export * as <module> from "./<module>"` — at the package root:

```ts
export * as clock from "./clock";
export * as config from "./config";
export * as db from "./db";
export * as di from "./di";
export * as logger from "./logger";
export * as outbox from "./outbox";
export { tryAsync } from "./try-async"; // root util, intentionally loose
```

Consumers reach the API through the namespace: `config.load(env)`, `di.createContainer()`, `logger.create({ … })`, `clock.system`, `db.createInMemory()`, and the class-like errors `config.ConfigError.format(e)` / `di.DiError.serialize(e)`.

Conventions:

- **Lowercase namespace** (`config`, `di`) — the ESM idiom for a module namespace (matches `my-approfile`); the class-like *errors* inside stay PascalCase (`config.ConfigError`).
- **Drop the redundant module-name suffix** at the surface via a barrel alias, keeping the canonical (greppable, doc-referenced) name in source: `loadConfig as load`, `createLogger as create`, `createInMemoryDb as createInMemory`, `systemClock as system`. Names that don't repeat the module keep their full form (`createContainer`, `token`, `selectSink`).
- **`import { load }` is blocked** — only `config.load()` is reachable from the package, which is the point. `const { load } = config` is still possible at runtime; it is a **convention to avoid** (flag in review), not a hard barrier.

## Alternatives considered

- (a) **Keep flat free-function exports** — rejected: no signal of module ownership; the surface doesn't communicate structure to humans or agents.
- (b) **`export default { … }` object per module** — rejected: matches the literal `import Config from "…"` ergonomics but needs `exports` subpaths per module, renames poorly, and default exports are discouraged in this ESM-first codebase.
- (c) **TypeScript `namespace` keyword** — rejected: pre-ESM construct, not tree-shakeable (whole namespace object retained), fights the functional/ESM grain. Not banned by the current Biome `recommended` set, so the decision is idiom + tree-shaking, not lint.

## Consequences

- **Positive**: the module each symbol belongs to is explicit at every call site; the package surface reads as a small set of namespaces; tree-shakeable; consistent with `my-approfile`. Canonical source names are unchanged, so doc/ADR references (`createLogger`, `loadConfig`) stay valid.
- **Negative**: one extra indirection (barrel alias) between source name and surface name; a contributor can still destructure the namespace (review catches it). Module-internal tests import the aliased surface name (`create`, `load`).
- **Scope**: applied to `platform` now; `modules/<context>` adopt the same convention as they grow public surface (EPIC-002+).

## References

- AGENTS.md — agent-first architecture (distinctive names, small surface)
- ADR-0008 / ADR-0009 — the class-like errors (`config.ConfigError`) exposed through these namespaces
- `packages/platform/src/index.ts` — the barrels
- `my-approfile` `services/auth/src/index.ts`, `packages/schemas/src/index.ts` — reference `export * as`
