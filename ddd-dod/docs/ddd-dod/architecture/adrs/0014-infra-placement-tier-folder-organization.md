# ADR-0014 — Infra placement & per-tier folder organization (three "infra"s; infra-free core)

- **Status:** Accepted
- **Date:** 2026-06-04
- **Milestone / Sprint:** EPIC-002 (active-foundation) — refines ADR-0012 (adapter placement) and SAD §2/§4

## Context

ADR-0012 + SAD §2 + playbook §5.2 put each context's persistence adapters **inside** the context package (`packages/modules/<ctx>/src/infra/`). Consequence: the context's "core" package **physically depends on Drizzle** — so the functional core is **not provably infra-free**, which undercuts a central thesis of the study (pure data + pure functions, decoupled from I/O — you should be able to point at the core package's `package.json` and show zero infra deps).

It also lumps three different things under one word, "infra":

1. **Outbound / driven** — persistence adapters (Drizzle sqlite/pg) that *implement* a port the application defines. **Shareable** across HTTP frameworks (Drizzle runs the same under Elysia or Fastify).
2. **Inbound / driving** — HTTP routes/controllers that *call* use-cases. **Framework-specific**, not shareable (an Elysia route is not a Fastify route).
3. **Technical ports + default adapters** — logger, clock, **DB connection**, http-kernel. Zero-domain.

No per-context adapter exists yet (they land in EPIC-003), so fixing the placement now is **~free**.

## Decision

Name the three infras; place them by kind; scale by tier.

- **Core package = `domain/` + `application/` only** (`packages/modules/<ctx>`), **zero infra dep**. The repository **port** (a hydrator signature, pattern #8) lives in `application`. This is what makes the core provably pure — the dependency rule (core ⊅ infra) is satisfied by the **package boundary**, not just by lint/convention.
- **Outbound adapters → a single `@ddd-dod/infra` package** (`packages/infra/src/modules/<ctx>/{sqlite,pg}`), **subpath-exported per context** (`@ddd-dod/infra/ledger`). Depends on each core + `platform`. One package, not one-per-context (see alt-a).
- **Inbound adapters (routes) → the delivery app** (`apps/api/src/http/modules/<ctx>`). They are framework-specific, so they belong with the framework, never in the shared `@ddd-dod/infra` (else a second-framework app couldn't reuse it).
- **`platform/db` keeps the `DbHandle` port + driver-flexible connection**; *instantiation* already happens at the composition root (ADR-0004). Multi-ORM: the ORM-specific connection **travels with the persistence stack**, not as `platform/db-<orm>` and not by moving `db/` into the app.
- **Per-tier folder organization** (the convention to fold into the playbook — see PLAYBOOK-LEARNINGS.md):
  - **prototype / small** — infra inside the context package (`src/{domain,application,infra}`); routes in the app. (Playbook §5.2 as-is; the core package *does* carry infra deps at this tier.)
  - **medium ← `ddd-dod`** — core package infra-free + single `@ddd-dod/infra` (outbound); routes in `apps/api`; composition root wires port→adapter.
  - **large** — as medium, but **multiple delivery apps** (`apps/api-elysia`, `apps/api-fastify`) each own their routes + composition root; the outbound `@ddd-dod/infra` stays **shared** (adapters never duplicate per app).

## Alternatives considered

- (a) **Per-context infra packages** (`@ddd-dod/<ctx>-infra`) — rejected for ddd-dod as needless granularity (4 extra `package.json`/`tsconfig`/`AGENTS.md`); the single `@ddd-dod/infra` with subpath exports gives the same decoupling, lighter. Revisit at large tier if one context's infra evolves independently.
- (b) **Keep infra inside the context package** (status quo — ADR-0012 / playbook §5.2) — rejected for medium+: the core is not physically pure, weakening the study thesis. Retained as the **prototype/small** convention.
- (c) **Outbound adapters into `apps/api`** — rejected: bloats the composition root, couples the app to every context's DB details, kills per-context isolation, and bundles a *shareable* thing (db adapters) with a *non-shareable* one (routes), defeating the multi-framework path.
- (d) **Move `platform/db` into `apps/api`** — rejected: `DbHandle` is a legit zero-domain technical port; instantiation already lives at the composition root; moving it re-couples the connection to one delivery app and breaks sharing across two framework apps.

## Consequences

- **Positive**: core packages **provably infra-free** (a demonstrable thesis artifact); outbound adapters cohesive, independently testable, and framework-agnostic; a clean path to multi-framework delivery (large tier); the swap (sqlite↔pg, later Drizzle↔another ORM) is visible at the composition root.
- **Negative**: one more package (`@ddd-dod/infra`) + its subpath-export config; the port↔adapter pair needs a contract test per context (already mandated by ADR-0012). The convention **diverges from playbook §5.2** — logged in `PLAYBOOK-LEARNINGS.md` for fold-back, **not** edited into the template mid-project (OQ-001).
- **Scope**: structure decision only — **no code yet**. `@ddd-dod/infra` + per-context adapters land in **EPIC-003**. **FEAT-006** is the first concrete *inbound-adapter-in-app* instance (`apps/api/src/http`). SAD §2/§4 updated to match; ADR-0012's "adapters in the context's `infra/`" is **superseded by this for medium+**.

## References

- ADR-0012 — persistence ports/adapters (adapter placement refined here)
- ADR-0004 — token DI container / composition root (instantiation site)
- SAD §2 (architectural style), §4 (package map), §6 (dataflow)
- `playbook/playbook-base.md` §5 (module organization), §21 (tier table)
- `PLAYBOOK-LEARNINGS.md` — detailed template-refinement write-up + per-tier folder trees
- `open-questions.md` OQ-001 (lapidation index)
