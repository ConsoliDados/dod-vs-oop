# ADR-0006 — Validation scope: Zod at external boundaries only

- **Status:** Accepted
- **Date:** 2026-06-03
- **Phase / Sprint:** 0 (bootstrap)

## Context

`playbook-ts.md` §6 mandates Zod at "every public input that comes from outside the program." Read literally, that could be taken to mean *every* deserialization — including a repository reading rows it itself wrote. The author's reference design draws a sharper line: runtime validation guards **untrusted** input; reading your own tables does not.

## Decision

Zod (`.strict()`) validates **external untrusted boundaries only**: HTTP request bodies/params/query, environment variables, and config files. It is **not** applied to:

- A bounded context reading **its own** persisted rows. That context is the sole writer; the domain guarantees invariants on the write path; schema drift is caught by migrations, not by a runtime guard. Repository rows are typed TypeScript interfaces, cast at the adapter, not re-parsed.
- Inter-context event payloads delivered via the outbox, whose shape is a versioned published contract owned in `shared-kernel` (validated, if at all, at the publishing boundary — not re-validated on every read).

## Alternatives considered

- **(a) Zod-parse everything, including own DB reads** — rejected: redundant runtime cost and code on a trusted path; conflates "untrusted input" with "deserialization." It also distorts the benchmark (validation overhead on the read hot path) without correctness benefit.
- **(b) No Zod anywhere, trust TypeScript types** — rejected: external input is genuinely untrusted; types are erased at runtime, so the HTTP/env/config boundary must be parsed.

## Consequences

- **Positive**: validation cost is paid once, where the data is actually untrusted; read hot paths stay lean (relevant to the CPU-bound benchmarks); clear mental model of where the trust boundary is.
- **Negative**: a migration that drifts the schema without updating the row interface would not be caught at runtime — accepted, and the reason migrations are the single source of schema truth.

## References

- `playbook-ts.md` §6 — Zod at boundaries (refined here)
- `../sad.md` §5 — validation scope
- `../srs.md` §2.2 — persistence durability out of scope (single-writer, in-process)
