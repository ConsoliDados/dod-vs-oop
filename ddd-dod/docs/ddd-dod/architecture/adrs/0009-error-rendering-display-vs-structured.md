# ADR-0009 — Error rendering: `format` (Display) vs `serialize` (structured)

- **Status:** Accepted
- **Date:** 2026-06-04
- **Milestone / Sprint:** EPIC-002 (active-foundation) — `feat/platform-conventions`

## Context

The bootstrap errors shipped with a single `format*Error(e): string` renderer used to log a boot failure before exiting non-zero. That is a legitimate **Display** (Rust parallel): human-readable, one line. The risk is reaching for the same string when an error needs to reach an **API response** or **observability** (logs/metrics/traces, ADR-0007). A Display string is wrong for both: an HTTP body wants a stable token + status + safe fields; a log/metric wants *structured* fields (kind, ids, latency), not a pre-concatenated blob that can't be queried.

## Decision

Every error-as-value carries **two** renderers (enforced by `defineError`, ADR-0008), with disjoint jobs:

- `format(e): string` — **Display.** Human-readable, single line. For boot/CLI logs only. **Never** an API body, **never** a log field value.
- `serialize(e): ErrorJson` — **structured.** A flat, serializable `{ kind, …safe fields }` record for observability. `unknown` causes are stringified at this boundary (never leaked raw). `ErrorJson` is deliberately **not** the logger's `LogFields`, so a domain error (e.g. in `shared-kernel`) never depends on the platform logger's vocabulary.

API responses are **not** a third renderer on the error: when modules grow HTTP routes (EPIC-003), mapping a variant → `{ status, token, safe fields }` happens at the route boundary (the `match`-per-variant pattern from `my-approfile` routes), because status codes and client-facing tokens are a transport concern, not a property of the error.

## Alternatives considered

- (a) **Keep only `format` (Display), stringify it into logs/responses** — rejected: unqueryable observability; leaks human phrasing into machine contracts.
- (b) **Make `serialize` return `LogFields`** — rejected: couples every error (including pure-domain ones) to the platform logger; `ErrorJson` is structurally compatible with `LogFields` without the dependency.
- (c) **Add an HTTP/`toResponse` renderer on the error now** — rejected: no routes exist yet, and status/token is a boundary concern; deferred to the route layer in EPIC-003.

## Consequences

- **Positive**: clean Rust-like split (Display vs structured); observability gets real fields; the boot log stays legible; pure-domain errors stay free of platform deps.
- **Negative**: two renderers to write per error (mechanical; `serialize` mirrors `format`'s `match`). The API mapping is intentionally absent until routes land — tracked, not forgotten.

## References

- ADR-0007 — observability stack (OTel/LGTM); `serialize` feeds the structured signal
- ADR-0008 — `defineError` requires both renderers
- `packages/types/src/errors.ts` — `ErrorRenderers`, `ErrorJson`
