# DDD DOD — Open Questions

Running list of things we haven't decided. Keep entries dated. Move to ADRs when resolved.

## Active

### OQ-001 — Fold validated DOD patterns back into the template playbook (2026-06-03)

This project is being used to **lapidate** the DOD/functional-core conventions before they enter the shared template. Patterns applied here in code + ADRs but **deliberately not yet added** to `~/Dev/consolidados/templates/project_templates/playbooks/playbook-ts.md`:

- `@consolidados/results` via a **wrapper package** (`@ddd-dod/types`: `./globals` + `./globals-types`) delivering ambient `Result`/`Option` + value globals across the monorepo — the library's documented monorepo pattern (ADR-0005). Carry-back caveat: under **Bun's isolated `node_modules`**, the ambient `.d.ts` must be wired via tsconfig **`include`**, not the `types` array (the docs' literal form doesn't resolve the workspace subpath as a type-reference directive). The template §4 still shows a hand-rolled `{ ok, value }` shape.
- `match` with a discriminant key for non-`Result` unions; `match` over Rust-enum-style operational errors.
- Branded ids via a private `unique symbol` + factory objects.
- Two error encodings: tagged Notification (domain validation) vs Rust-enum operational (ports). When to use each.
- Infra adapters as factories (no class) + module-private closures + `tryAsync` boundary wrapper.
- Zod scope refinement: external untrusted boundaries only, not the own-context read path (ADR-0006).
- Recommended tsconfig extras (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).

Decide at project close: which of these proved out → PR into the template playbook. **Do not edit the template mid-project.**

### OQ-002 — DI container vs manual composition root (2026-06-03)

ADR-0004 adopts a token-based DI container, deviating from the playbook's "no DI container" rule. Open: does the typed container earn its keep over manual wiring at the composition root, given use cases already take deps as params?

Leaning: keep it for EPIC-002, re-evaluate at epic close. If it adds ceremony without payoff, demote to manual wiring and supersede ADR-0004.

### OQ-003 — Query layer: Drizzle vs raw SQL (2026-06-03)

ADR-0001 pins Drizzle for parity with `ddd-modern`. The author's reference infra design uses raw SQL (Slonik) with typed row interfaces and no Zod on reads. The *style* (factory adapters, `tryAsync`, no-Zod-reads) is adopted regardless; open whether the query mechanism itself (Drizzle query builder vs raw SQL) should be reconsidered for the hot-path benchmarks.

Decide if/when the query layer becomes a measured variable. No change for bootstrap.

## Resolved

(None yet — move resolved items here with a date and a one-line summary, or a link to the ADR/SDD that captured the decision.)
