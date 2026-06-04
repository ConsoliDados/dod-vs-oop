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
- **`defineError` + `EnumValues`** as the single error-as-value spelling, with **validator-neutral payloads** (`ValidationIssue`, not `z.ZodIssue[]`) — ADR-0008. Refines OQ-001 bullet "two error encodings": the *operational* (Rust-enum) encoding now has a canonical helper. Carry-back caveat: `EnumValues` must allow constructors returning `string | object` (nullary tag variants + payload variants); the `const` type param on `defineError` needs TS 5.0+.
- **Two error renderers** `format` (Display, string) vs `serialize` (structured `ErrorJson`), required by `defineError`; API mapping deferred to the route boundary — ADR-0009.
- **ESM namespace barrels** (`export * as config`) for a module's public surface, lowercase namespace + dropped redundant suffix via barrel alias (`loadConfig as load`) — ADR-0010. (2026-06-04, `feat/platform-conventions`.)
- **Infra placement & per-tier folder organization** — ADR-0014. Name the three "infra"s: inbound (driving, HTTP routes → the app), outbound (driven, persistence adapters → a dedicated `@ddd-dod/infra` package), technical ports (→ `platform`). Core package = `domain` + `application` only (provably infra-free; the port lives in `application`). Scales prototype→large. Refines playbook **§5.1/§5.2** ("adapters in an `infra/` subfolder") and adds a **placement row to the §21 tier table** — the missing *tier* axis (file-count promotion stays orthogonal). Full write-up + per-tier folder trees in **`architecture/playbook/PLAYBOOK-LEARNINGS.md` (L-001)**. (2026-06-04.)

Decide at project close: which of these proved out → PR into the template playbook. **Do not edit the template mid-project.** Detailed write-ups now live in `architecture/playbook/PLAYBOOK-LEARNINGS.md`.

### OQ-002 — DI container vs manual composition root (2026-06-03)

ADR-0004 adopts a token-based DI container, deviating from the playbook's "no DI container" rule. Open: does the typed container earn its keep over manual wiring at the composition root, given use cases already take deps as params?

Leaning: keep it for EPIC-002, re-evaluate at epic close. If it adds ceremony without payoff, demote to manual wiring and supersede ADR-0004.

### OQ-003 — Query layer: Drizzle vs raw SQL (2026-06-03)

ADR-0001 pins Drizzle for parity with `ddd-modern`. The author's reference infra design uses raw SQL (Slonik) with typed row interfaces and no Zod on reads. The *style* (factory adapters, `tryAsync`, no-Zod-reads) is adopted regardless; open whether the query mechanism itself (Drizzle query builder vs raw SQL) should be reconsidered for the hot-path benchmarks.

Decide if/when the query layer becomes a measured variable. No change for bootstrap.

## Resolved

(None yet — move resolved items here with a date and a one-line summary, or a link to the ADR/SDD that captured the decision.)
