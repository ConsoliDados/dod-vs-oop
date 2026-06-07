# Epics

A grouping of related **features** under a roadmap **Milestone**, with its own completion criteria (`exits_with`). In the management chain **Milestone → Epic → Feature → Task**, the Epic sits below a milestone (a delivery grouping; see `../01-milestones/`) and above the Features that realize it (one Feature = one FRD, 1:1; see `../03-features/`). Distinct from `../03-features/` (the units that realize it) and `../../backlogs/` (ideas not yet committed).

Cards live flat here as `<NNN>-<slug>.md`; status drives the `../00-dashboard/02-epics.board.md` kanban (**Planned · Active · Done · Parked**). Create one with `.obsidian/templates/epic-template.md`.

## Types

Each epic declares a `type` in its frontmatter:

- **capability** — themed body of product work (`ledger`, `accounts`). Most product work is `capability`.
- **refactor** — quality / restructuring.
- **infra** — CI/CD, observability, dev tools. (The scaffolding epic `EPIC-001 — scaffold` is `type: infra`.)

Temporal grouping — `bootstrap`, `MVP`, `v1` — is **not** an epic type: it's a **Milestone** (see `../01-milestones/`). A Milestone spans 1..N epics/SDDs (Milestone : SDD = 1 : N).

## Epic references an SDD (it does not equal one)

An **Epic references one SDD** via its `sdd:` field — it is *not* the same object as the SDD (Epic : SDD ≈ 1 : 1). A **domain** epic (`capability`) references exactly one bounded context — its agnostic tactical bible, the flat file `../../architecture/sdds/sdd-<slug>.md`; its functionalities are **FRDs** (`../../architecture/frds/frd-<slug>.md`, 1:1 with the Features that realize them). Set the epic's `sdd:` field to that SDD's ID. A **cross-cutting** epic (`refactor`, `infra`) has no bounded context — leave `sdd:` blank. The reference is one-way: the epic points at the SDD; the SDD (agnostic, no `epic:` field) never points back (playbook §22.1).

## Workflow

1. **Plan** — Create the epic card via `.obsidian/templates/epic-template.md`. Fill in `why`, `outcome`, `scope`, `exits_with`, and the `milestone:`/`sdd:` refs. Add to the kanban under **Planned**.
2. **Activate** — When its milestone commits to advancing this epic, move it to **Active**.
3. **Track** — Feature cards belonging to this epic carry `epic: <id>-<slug>` in their frontmatter (containment is by **reference**, not folder nesting — features live flat in `../03-features/`). Progress is logged in the epic card as features close.
4. **Close** — When all `exits_with` are checked, move to **Done**. The epic merges to `dev` via PR (AGENTS §Branching). Per playbook §16.4, at this project's **small** tier a `dev → main` release is triggered by **epic** close — semver bump, tag, changelog.
5. **Park** — Use **Parked** for epics deferred indefinitely. Document the reason in the epic card.

## Relationship to other artefacts

```
Backlog (ideas)
    ↓ promote
Milestone (delivery grouping)   ← ../01-milestones/
    ↓ contains
Epic (this folder)              milestone: <id>-<slug> · sdd: sdd-<slug>
    ↓ realized by
Feature (1:1 FRD) → Tasks       ← ../03-features/ ; epic: <id>-<slug> · frd: FRD-<NNN>
    ↓ exits_with all checked
Epic → Done → release (playbook §16.4)
```

Features are **reference-based**, not nested: a feature card in `../03-features/` declares `epic: <id>-<slug>`. The FRD spec lives in `../../architecture/frds/frd-<slug>.md` — `ddd-dod` keeps **split FRD files** (a medium+ pattern; it runs the small *branching* tier but its docs/structure exceed small's minimums by design — see root `AGENTS.md`). There is **no `frds/` folder in the roadmap** and **no `research.md`/`plan.md`/`act.md`**: RPA is a mental discipline, the code is the Act, durable decisions go to an ADR.
