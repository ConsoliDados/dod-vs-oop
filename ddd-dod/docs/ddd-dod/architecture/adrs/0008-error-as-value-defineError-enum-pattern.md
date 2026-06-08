# ADR-0008 — Error-as-value shape: `defineError` + `EnumValues`, validator-neutral payloads

- **Status:** Accepted
- **Date:** 2026-06-04
- **Milestone / Sprint:** EPIC-002 (active-foundation) — `feat/platform-conventions`

## Context

ADR-0002 fixed *error-as-value* (`Result<T, E>`, Notification, no `throw`) but left the **shape** of an `E` to each module. Two problems surfaced as the platform grew:

1. **Inconsistency.** `DiError` was a hand-written `{ NotRegistered: {…} } | …` union *plus* a separate constructor namespace (two things to keep in sync); `ConfigError` was a field-tagged `{ type: "InvalidConfig"; … }` struct read by hand instead of via the global `match`. Same concept, three spellings.
2. **Validator leak.** `ConfigError` carried `z.ZodError["issues"]` directly in its type. Swapping the validator (Zod → TypeBox) would change the *error type* and ripple to every consumer — the boundary library bleeding into the error contract.

The author's reference design (`my-approfile`) already uses an `EnumValues` helper to derive the union from a const object of variant constructors. We adopt it here and go one step further on the coupling (the reference still stores `z.ZodIssue[]`).

## Decision

We will define every error-as-value with a single helper, `defineError`, in `@ddd-dod/types`:

- The **union type** is derived from a const `variants` object by `EnumValues<typeof variants>` — bare-string variants (`() => "AccountNotFound"`) and single-key-object payload variants (`(since) => ({ Frozen: { since } })`) both supported, key-as-tag so the global `match` dispatches directly.
- The **runtime object** fuses those constructors with the two renderers (see ADR-0009) on one frozen value, class-like: `DiError.notRegistered("db")` to construct, `DiError.format(e)` / `DiError.serialize(e)` to render. `defineError`'s signature *requires* both renderers, so no error can ship without them.
- Error **payloads are validator-neutral.** Config validation issues are a local `ValidationIssue = { path: string; message: string }`; the Zod → `ValidationIssue` mapping lives in `loadConfig` as the single seam that knows about Zod. The `ConfigError` type never mentions the validator.

`EnumValues` derives the union from the **variants alone**, so the `format`/`serialize` function members never leak into the error's value type.

## Alternatives considered

- (a) **Keep hand-written unions + separate `format*` free functions** — rejected: the duplication that caused the three-spellings drift; nothing enforces a renderer exists.
- (b) **Adopt `EnumValues` but keep `z.ZodIssue[]` (mirror the reference exactly)** — rejected: leaves the validator coupling the author explicitly flagged; the neutral `ValidationIssue` is cheap.
- (c) **A class hierarchy / `Error` subclasses** — rejected: that is the `ddd-classic` (OOP) side; this project is functional-core, errors are plain data.

## Consequences

- **Positive**: one spelling for every error; adding a variant auto-extends the union and turns a missing `match` arm into a type error; swapping the validator touches one `map`, not the error contract; renderers are guaranteed present.
- **Negative**: a small amount of type machinery (`EnumValues`, the `const`-generic `defineError`) lives in `@ddd-dod/types`; contributors must learn the `variants` + `defineError` idiom (documented in the helper's doc-comment).
- **Follow-up**: this is a refinement of the template's error guidance — logged under OQ-001 for fold-back into the shared playbook at project close (not edited into the template mid-project).

## References

- ADR-0002 — error-as-value / Notification / no-throw (this gives it a concrete shape)
- ADR-0005 — results globals (`match`, `Result`) via `@ddd-dod/types`
- ADR-0006 — Zod at boundaries only (the neutral `ValidationIssue` keeps that boundary from leaking into the error type)
- ADR-0009 — the `format`/`serialize` renderers `defineError` requires
- `packages/types/src/errors.ts` — `EnumValues`, `ErrorJson`, `defineError`
- `my-approfile` `packages/types/src/result-helpers.ts` — reference `EnumValues`
