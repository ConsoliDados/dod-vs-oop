# ADR-0005 — Framework-agnostic application layer (DI wiring in infrastructure)

- **Status:** Accepted
- **Date:** 2026-05-22
- **Phase / Sprint:** EPIC-002 (ledger-core), during FEAT-001 follow-up

## Context

FEAT-001 first shipped use cases as NestJS providers: `@Injectable()` classes with `@Inject(TOKEN)` constructor parameters, the repository DI tokens declared in the `application/` port files, and the bounded-context `<context>.module.ts` at the context root. That couples the application layer to NestJS — the exact pattern the production reference (`a real-world production ledger system`) had already moved away from.

Two forces make decoupling worth doing now, before more features land:

- **A third study project is planned**: the same verbose-canonical OOP design re-hosted on **Bun + Elysia + in-memory** (the `classic-modern` variant, SAD §8). It enables the honest benchmarks the study wants — `oop-classic` (classic stack) vs `oop-dod` (modern stack), and `oop-classic` vs `oop-dod` on the *same* modern stack, isolating the architectural variable from the stack confounder (ADR-0001). If the application layer imports NestJS, that re-host means rewriting use cases, not just infrastructure.
- **The SAD already mandates it**: SAD §4 says `application/` depends on its own `domain/` + ports and **never** on `infrastructure/`. The first cut violated this by importing the concrete `InMemoryEventBus` and by carrying NestJS decorators.

## Decision

`domain/` and `application/` are **framework-free** plain TypeScript. NestJS is confined to `infrastructure/`.

- **Use cases** are plain classes (no `@Injectable` / `@Inject`); the constructor takes **ports** — repository interfaces and the `EventBus` port — as arguments.
- **DI tokens + providers** live in `infrastructure/provider/{usecases,repositories}/`. Each provider file declares its `Symbol` token next to the binding: use cases via `{ provide, inject, useFactory: () => new XUseCase(...) }`, repository ports via `{ provide, useClass: XTypeOrmRepository }`.
- The **framework module** (`<context>.module.ts`) moves into `infrastructure/`, composing those providers.
- The **`EventBus` port** lives in `src/shared/application/`; its implementation + token in `src/shared/infrastructure/`.
- Controllers (infrastructure) inject use cases via `@Inject(<TOKEN>)`.

## Alternatives considered

- **(a) Keep use cases as `@Injectable` providers (the first cut)** — rejected: couples application to NestJS, breaks SAD §4, and forces a use-case rewrite for the Elysia/Bun re-host.
- **(b) Decouple use cases but leave repository tokens in `application/`** — rejected: a `Symbol` token is DI-wiring metadata; colocating it with the port leaks the wiring concern into the framework-free layer. Tokens belong next to their provider.
- **(c) A DI container in the application layer (e.g. tsyringe) shared across infras** — rejected: adds a dependency and its own coupling; the win is marginal when each infra already has a native composition mechanism (NestJS providers, or plain `new` under Elysia).

## Consequences

- **Positive**: `domain/` + `application/` re-host to Bun + Elysia by writing a new `infrastructure/` only (controllers + providers + repo impls); the application code is identical across both stacks, which is exactly what makes the `classic` vs `classic-modern` benchmark honest. Cleaner test surface — use cases are unit-testable with hand-built fakes, no `Test.createTestingModule`.
- **Negative**: more files (a provider per use case / repository) and one extra indirection (`useFactory`) versus type-based autowiring. Accepted: it's the verbose-canonical reality and the decoupling is the point.
- **Follow-up**: applies to every context from here on (FEAT-002 `ledger`, etc.). The playbook per-bounded-context structure and `src/<context>/AGENTS.md` are updated to match.

## References

- `../sad.md` §4 — dependency rules (`application/` never imports `infrastructure/`)
- `../sad.md` §8 — `classic-modern` (Bun + Elysia) future variant; study `../../../../README.md`
- `../../playbook/playbook.md` §10 + per-bounded-context structure — framework-agnostic use cases, provider layout
- ADR-0001 — stack + known confounder this decision helps neutralize
- ADR-0003 — the `EventBus` port abstracts the in-memory bus (vs the DOD side's Outbox)
