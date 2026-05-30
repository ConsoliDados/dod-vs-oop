# ADR-0002 — Throw on first violation (no `Result<T, E>`)

- **Status:** Accepted
- **Date:** 2026-05-21
- **Phase / Sprint:** 0 (bootstrap)

## Context

The author's general playbook and the sibling `ddd-dod` use a **never-throws** approach: `Result<T, E>` with a Notification Pattern (validators accumulate errors and return them) and an external `match` helper. That is the DOD side's defining error strategy.

For this foil to contrast meaningfully, it must adopt the **opposite, equally-real** strategy used by classic verbose DDD in production (`a real-world production ledger system`): exceptions. The DDD core template (`~/Dev/projects/ddd-templates`) actually offers a `Result`-based path, but the production code that derived from it switched to throwing (there's even a `// FIX: Refactor Email VO` note acknowledging the tension). We follow the production reality, not the template default.

## Decision

We will use **throw on first violation**. Concretely:
- Validators accumulate errors in a stack (`addError`), but `validate()` returns `void` and **throws** the aggregated error (`InvalidEntityError` / `InvalidValueObjectError` / `InvalidIdentifierError`) at the end if any were collected.
- Entity/VO constructors invoke their validator, so an invalid instance can never be constructed.
- Use cases return `Promise<TResponse>` directly; failures propagate as typed exceptions.
- A NestJS exception filter maps the `DomainError` hierarchy to HTTP status codes and the SRS error shape.
- **No `Result<T, E>`, no `match` helper** anywhere in this project.

## Alternatives considered

- **(a) `Result<T, E>` + Notification Pattern** — rejected *for this project*: it's the DOD side's strategy; using it here would dilute the comparison (half the DOD gains would already be present in the foil).
- **(b) Throw, but fail-fast at the first error (no accumulation)** — rejected: production verbose DDD typically accumulates field errors for a complete validation response, then throws once. We keep accumulation, only the *delivery* is a throw.
- **(c) Mixed (Result in domain, throw in application)** — rejected: inconsistency would make the foil harder to read and weaken the "this is what classic looks like" message.

## Consequences

- **Positive**: faithful to production verbose DDD; instances are always valid by construction; the contrast with the DOD side is crisp and quotable (throw vs `match`).
- **Negative**: exceptions are invisible in signatures (the caller must know what can throw); `try/catch` in tests and at the HTTP boundary; a thrown error that is almost never hit still costs stack-unwind on the rare path. These are exactly the trade-offs the study wants to surface.
- **Follow-up**: the conformance suite (SRS NFR-CORRECT-001) must assert the same error *shape* as the DOD side despite the different delivery mechanism.

## References

- `../srs.md` NFR-OBS-001, NFR-CORRECT-001 — error shape is contractual, delivery is not
- `../../playbook/playbook.md` §1, anti-patterns — throw-based mantra
- ADR-0001 — stack this builds on
- `@consolidados/results` (the DOD side's library) — what we deliberately do **not** use here
