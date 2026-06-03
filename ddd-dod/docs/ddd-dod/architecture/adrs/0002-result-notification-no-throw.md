# ADR-0002 — Result + Notification pattern (no `throw`)

- **Status:** Accepted
- **Date:** 2026-06-03
- **Phase / Sprint:** 0 (bootstrap)

## Context

The shared [`srs.md`](../srs.md) defines validation-class and not-found error behaviors abstractly. Each implementation chooses how to realize control flow. `ddd-classic` throws on the first violation (its ADR-0002). `ddd-dod` is the **error-as-value** counterpart and must show the opposite discipline faithfully — not as a strawman, but as the real functional-core style.

## Decision

Domain and application code is **`throw`-free**. Errors are values:

- **Smart constructors / domain transitions** return `Result<T, E>`. Validation uses the **Notification pattern**: errors **accumulate** into `InvalidProperty[]` — never `throw`, never `return null`, never early-return on the first violation. The caller receives the complete validation set.
- **Use-case flow ends in a single `match`** (`match(result, { Ok, Err })`). `if (result.isErr())` is **not** used inside a use-case body; it is allowed only in the imperative runner/boundary (e.g. an HTTP handler loop or the outbox dispatcher).
- **Infra boundaries** catch native exceptions (DB driver, I/O) and convert them to `Err` via a `tryAsync` wrapper. Exceptions never propagate out of an adapter as exceptions.

## Alternatives considered

- **(a) Throw on first violation (the `ddd-classic` approach)** — rejected here by definition; it is the other side of the study.
- **(b) Return the first error only (`Result<T, SingleError>`)** — rejected: loses the Notification benefit (full validation in one round-trip), which is a selling point of the pattern.
- **(c) Exceptions for "exceptional" cases, `Result` for expected ones** — rejected: the mixed model reintroduces the side channel the study is contrasting; `ddd-dod` commits fully to values.

## Consequences

- **Positive**: total, type-visible error handling; full validation surfaced at once; pure domain functions are trivially testable.
- **Negative**: more explicit plumbing than throw/catch; mitigated by `@consolidados/results` + external `match` (ADR-0005) keeping call sites terse.
- **Follow-up**: ADR-0005 pins the `Result` library and its global activation.

## References

- `../sad.md` §2, §5 — error-as-value style and the two error encodings (tagged Notification vs Rust-enum operational)
- `ddd-classic` ADR-0002 — the throw-based counterpart
- memory `feedback_never_throws`
