# ADR-0004 — Token-based DI container (composition-root only)

- **Status:** Accepted
- **Date:** 2026-06-03
- **Phase / Sprint:** 0 (bootstrap)

## Context

Use cases are free functions taking their dependencies as parameters (SAD pattern #4). Something must build the concrete adapters (repositories, logger, clock, outbox) and hand them in. `playbook-base.md` §3.4/§6 and `playbook-ts.md` §8 prescribe **no DI container** — manual wiring at a composition root. The author has nonetheless decided to use a **real token-based container** for this project (a lapidation choice; what proves out here may flow back into the template later).

## Decision

A **token-based DI container** lives in `packages/platform/` (a registry: `register(token, factory)` / `resolve(token)`). It is used **only at the `apps/api` composition root** to assemble dependencies, which are then passed positionally into free-function use cases. The container is **never imported by `domain/` or `application/`** code — use cases stay container-agnostic and receive plain dependency objects. No decorator-based injection (`@Injectable`/`@Inject`); that is the `ddd-classic`/Nest style.

This **deviates** from the playbook's "no DI container" rule; the deviation is deliberate and bounded by the composition-root-only constraint above.

## Alternatives considered

- **(a) Manual composition root, no container (the playbook default)** — viable and simpler; deferred in favor of evaluating a typed container's ergonomics for the study. May be reverted if it adds ceremony without payoff (logged as an open question).
- **(b) Decorator-based DI (NestJS-style)** — rejected: that is the OOP foil's style and would blur the architectural contrast.

## Consequences

- **Positive**: centralized, typed wiring; easy test substitution (register fakes); keeps use cases pure (deps still passed as params).
- **Negative**: a container is indirection the playbook warns against; risk of it leaking toward the domain. Mitigated by the hard rule: container only at the composition root, never in `domain/`/`application/`.
- **Follow-up**: revisit at epic close — if the container earned its keep, propose folding the pattern into the template playbook; otherwise demote to manual wiring.

## References

- `playbook-base.md` §3.4, §6 — "no DI container" (the rule this ADR deviates from)
- `playbook-ts.md` §8 — use cases as functions with deps as parameters
- `../sad.md` §4 — `platform/` as the dependency sink
