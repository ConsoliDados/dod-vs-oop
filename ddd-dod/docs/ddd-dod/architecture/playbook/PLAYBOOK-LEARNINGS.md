# Playbook learnings — refinements proven here, to fold into the template at close

This file is the **detailed companion** to `../../open-questions.md` **OQ-001**. OQ-001 is the
running *index* of conventions lapidated in this project; this file holds the **full write-up**
of each one — what the template says today, what we learned, and the exact change to fold.

**Rules of engagement** (per OQ-001 and project AGENTS):
- Refinements are applied **here** — in this project's code, ADRs, SAD, and these playbook copies.
- The **shared template** (`~/Dev/consolidados/templates/project_templates/playbooks/`) is **NOT**
  edited mid-project. What proves out gets PR'd into the template **at project close**.
- Each entry below names the template **§ to amend** so the fold is mechanical.

---

## L-001 — Infra placement & per-tier folder organization

**Source:** ADR-0014 (2026-06-04). Refines playbook **§5.1 / §5.2** ("adapters in an `infra/`
subfolder", "promote past ~5 files") and adds a **placement row to the §21 tier table**.

### What the template says today

- §5.1 — "each top-level module is a bounded context … owns its repository trait."
- §5.2 — "Adapters in their own subfolder (`infra/`, `adapters/`, `repositories/`)" and "In
  small/prototype tiers this collapses into a flat module … promote the structure when the
  context grows past ~5 files."

So the template's only placement guidance is *intra-package* (`infra/` lives inside the context),
and the promotion axis it names is **file count**, not **tier**.

### What we learned

Calling everything "infra" hides that there are **three** kinds, with different shareability and
therefore different homes:

| Kind | What | Shareable across HTTP frameworks? | Home |
|------|------|:--:|------|
| **Outbound / driven** | persistence adapters (Drizzle sqlite/pg) — *implement* a port | **yes** | a dedicated infra package |
| **Inbound / driving** | HTTP routes/controllers — *call* use-cases | **no** (Elysia ≠ Fastify) | the delivery app |
| **Technical ports** | logger, clock, DB connection, http-kernel — zero-domain | n/a (ports) | `platform/` |

Once named, placement falls out, and it **scales by tier** (the missing axis). The point of the
split at medium+ is that the **core package becomes provably infra-free** — the dependency rule
(core ⊅ infra) is enforced by the *package boundary*, not just by lint.

### Per-tier folder organization (the fold)

**prototype / small** — infra inside the context package; routes in the app. Core package *does*
carry infra deps at this tier (the §5.2 status quo).

```
packages/modules/<ctx>/        @ddd-dod/<ctx>
  src/{domain, application, infra}/     # infra/ = sqlite/pg adapters
apps/<app>/                    routes/controllers (inbound)
# core package depends on the ORM here
```

**medium** ← this project — core package infra-free; one outbound infra package; routes in the app.

```
packages/modules/<ctx>/        @ddd-dod/<ctx>     CORE
  src/{domain, application}/            # port lives in application; ZERO infra dep
packages/infra/                @ddd-dod/infra     OUTBOUND (one package, subpath per ctx)
  src/modules/<ctx>/{sqlite, pg}/       # implements <ctx>'s port
apps/api/                      delivery + composition root
  src/http/modules/<ctx>/              # INBOUND (routes)
  src/composition-root.ts              # wires port -> adapter by driver
platform/db/                   DbHandle port + driver-flexible connection (technical)
```

**large** — as medium, but multiple delivery apps; outbound stays shared (never duplicated).

```
packages/modules/<ctx>/        @ddd-dod/<ctx>     CORE
packages/infra/                @ddd-dod/infra     OUTBOUND (shared by every app)
apps/api-elysia/   src/http/...  + composition root    # inbound, framework A
apps/api-fastify/  src/http/...  + composition root    # inbound, framework B
# adapters NEVER duplicate per app; only routes are per-app
```

### Carry-back caveats

- Promotion is now **two-dimensional**: the §5.2 file-count trigger (when a context's internals
  earn the `domain/application/` split) is orthogonal to the **tier** trigger (when *infra* leaves
  the context package). Keep both.
- Per-context infra **packages** (`@ddd-dod/<ctx>-infra`) are a *large-tier* option, not the
  medium default — at medium, one `@ddd-dod/infra` with subpath exports is lighter (ADR-0014 alt-a).
- `platform/db` stays a **port**; multi-ORM connections travel with the persistence stack, never
  as `platform/db-<orm>` (ADR-0014 alt-d).

---

## L-002 — Branching: tiered git-flow, numbered branches, commit-driven CI/CD

**Source:** branching-model decision (2026-06-06). Refines playbook **§16.2 / §16.3 / §16.4**.
**Folded to the template immediately** (`templates/project_templates/playbooks/playbook-base.md`)
with the author's explicit consent — an **exception** to the default "apply here, fold at close":
the convention is project-agnostic, so it went straight into the template **and** this project's copy.

### What changed
- **`milestone` is not a branch** (≤ medium). It is a planning grouping + the release marker (the
  `dev → main` tag). The old `milestone → epic → feature` nesting (a ddd-dod extension) collapses:
  **`epic` is the PR unit** — to `dev` at prototype/small, or to a `release/<NNN>` branch at medium+
  (see the revised "Tier scaling" below).
- **Numbered branches matching roadmap cards:** `feat/<NNN>-<slug>`, `epic/<NNN>-<slug>`,
  `release/<NNN>-<slug>` (3 digits; FEAT-006 → `feat/006-…`). Namespace = type (greppable), `<slug>`
  unscoped.
- **Tier scaling (revised 2026-06-06 — supersedes the original line):** **every** tier merges
  `feat→epic` **locally** and the epic is the PR unit; the `release/` boundary sits at **medium**, not
  large. **prototype/small** → epic PRs to `dev` (release = `dev→main` tag, no `release/` branch);
  **medium/large** → epic PRs to a `release/<NNN>` branch (`release→dev→main`). *(Original, now wrong:
  "prototype/small `feat→dev`; medium `feat→epic→dev PR`; only large adds `release/`." The conflict —
  small had no epic branch, medium had no `release/` — was flagged by another session updating a small
  project; the corrected table moved the `release/` floor up to medium and gave every tier the epic
  branch.)*
- **CI/CD split:** gates trigger off **refs**; release version/changelog come from **Conventional
  Commits** (not branch names) → free to use our own names. Add a `commitlint` gate; keep
  `feat:`/`fix:` commits readable across merges (preserve or Conventional squash titles).

### Carry-back note
Already applied to `playbook-base.md` §16.2 (rewritten "Git Flow (tiered)"), §16.3 (PR-unit-by-tier
note), §16.4 (epic/milestone-close trigger) in **both** the template and this project's copy — **no
further fold needed at close** for this item. The **2026-06-06 revision** (every tier gets the epic
branch; `release/` floor moved to medium) was likewise applied to **both** the template and this copy.

> **ddd-dod resolution (2026-06-06):** rather than adopt the new medium `release/<NNN>` flow,
> **ddd-dod was reclassified medium → small** — small PRs each epic straight to `dev` (no `release/`),
> which *is* the in-flight `epic→dev` policy, so no grandfathering is needed. The package layout still
> exceeds small's minimums (medium+ infra-free split, ADR-0014) **by design** — tier is a floor, not a
> ceiling. Recorded in the root `AGENTS.md` (Methodology + Branching) and `sad.md`.

---

## Index of other OQ-001 items (write-ups pending)

These are tracked in OQ-001 and will get full write-ups here as they're folded:

- Results-globals wrapper (`@ddd-dod/types`) + the Bun-isolated-`node_modules` `tsconfig.include`
  caveat (ADR-0005).
- `defineError` + `EnumValues`, validator-neutral payloads (ADR-0008); `format` vs `serialize`
  renderers (ADR-0009); ESM namespace barrels (ADR-0010).
- DI container vs manual composition root (OQ-002 / ADR-0004); the playbook's "no DI container"
  stance to soften (ADR-0011).
- Worker-pool dispatch as a pluggable strategy (ADR-0013).
