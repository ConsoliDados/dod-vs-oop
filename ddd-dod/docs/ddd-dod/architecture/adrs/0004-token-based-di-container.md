# ADR-0004 — Token-based DI container (composition-root only)

- **Status:** Accepted · **amended 2026-06-04** (Result-native — **never throws**; adds lifecycle/`dispose`; built to be reused across projects)
- **Date:** 2026-06-03
- **Phase / Sprint:** 0 (bootstrap) → hardened in EPIC-002 FEAT-003

## Context

Use cases are free functions taking their dependencies as parameters (SAD pattern #4). Something must build the concrete adapters (repositories, logger, clock, outbox) and hand them in. `playbook-base.md` §3.4/§6 and `playbook-ts.md` §8 prescribe **no DI container** — manual wiring at a composition root. The author has nonetheless decided to use a **real token-based container** for this project (a lapidation choice; what proves out here may flow back into the template later).

## Decision

A **token-based DI container** lives in `packages/platform/` (a registry: `register(token, factory)` / `resolve(token)`). It is used **only at the `apps/api` composition root** to assemble dependencies, which are then passed positionally into free-function use cases. The container is **never imported by `domain/` or `application/`** code — use cases stay container-agnostic and receive plain dependency objects. No decorator-based injection (`@Injectable`/`@Inject`); that is the `ddd-classic`/Nest style.

This **deviates** from the playbook's "no DI container" rule; the deviation is deliberate and bounded by the composition-root-only constraint above.

**Amendment (2026-06-04) — never throws, Result-native, reusable.** This container is intended to be **reused across the author's other projects**, so it is built to a higher bar (better than the `conecta` reference, which was a class-based static singleton with a throwing `get`). Concretely:

- **`resolve<T>(token)` returns `Result<T, DiError>` and never throws.** The earlier "fail-fast: a misconfiguration throws at startup" stance is **superseded** — resolution failures (`NotRegistered`, `CircularDependency`, `FactoryFailed`) are **values**, captured at the composition root / bootstrap, which then performs a **graceful shutdown** (FEAT-004) instead of crashing. This extends the no-throw discipline (ADR-0002) to the wiring layer too.
- **Lifecycle.** The container tracks `Disposable` singletons and `dispose()`s them in **reverse creation order** (swallow-and-log per item; never throws) — the seam the graceful shutdown uses.
- **Functional, no class.** Instance-per-`createContainer()` over closures — **no `class`, no static singleton** (the specific thing that aged badly in the `conecta` container). Typed `Token<T>` (unique `Symbol`), `singleton` (default) + `transient` lifetimes.
- **Out (anti-gold-plating):** no Bun-Worker serialize/hydrate, no module registry, no decorators, no child/request-scoped containers (per-request correlation is `logger.child()`, not a DI scope).

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
