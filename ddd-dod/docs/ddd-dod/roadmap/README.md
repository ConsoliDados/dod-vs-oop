# Roadmap

Source of truth for **commitments** — work that has been decided and will (or is) happen(ing). Distinct from `backlogs/`, which is **ideas**.

## Layout

```
roadmap/
├── _dashboard/
│   └── board.md          ← Obsidian Kanban view; columns: Initial / In Progress / Done
├── milestones/
│   └── <id>-<slug>.md    ← per-milestone card (delivery grouping; spans 1..N SDDs/epics)
├── archived/             ← delivered/closed cards & milestones (never delete; move here)
├── <id>-<slug>.md        ← per-card file with planning notes
└── README.md             ← this file
```

## Milestones

A **Milestone** is a roadmap-level delivery grouping — the construct that replaces the dead "phase" (playbook §22.1, §25). It is **management, not a doc**: it spans **1..N SDDs/epics plus cross-cutting work** (Milestone : SDD = 1 : N — a milestone like "auth" groups several domains; cross-cutting/infra work sits in a milestone with **no** SDD) and **references** the SDDs/epics it delivers. The reference is one-way (milestone → docs/epics); the docs never point back.

Create one with the Templater snippet `.obsidian/templates/milestone-template.md` (lands under `milestones/<id>-<slug>.md`). In planning, the question per domain is *"does this domain have an SDD yet? no → create one"*; cross-cutting work enters the milestone without an SDD.

Portability (playbook §25): a Milestone maps to a Jira Initiative / Linear Project.

## Workflow

1. A card from the backlog gets **promoted** to the roadmap once the work is decided to happen. Move the card's file into `roadmap/<id>-<slug>.md` (rename ID prefix as needed) and add it to the kanban under **Initial**. Set its `epic:` (and, if known, `frd:`/`sdd:`).
2. When work starts, move the card to **In Progress**. The card belongs to an **Epic** (which references one **SDD** — a domain — via `sdd:`, or none if cross-cutting) and is realized by one **Feature** (1:1 with one **FRD**). If the FRD doesn't exist yet, author it as the flat file `../architecture/frds/frd-<slug>.md` (RPA is a mental discipline — one artifact, no `research.md`/`plan.md` siblings). Then create the **feature-keyed** build folder under `../sprints/<sprint>/features/<feature-slug>/README.md` (Mode A) or the active epic's `features/<feature-slug>/README.md` (Mode B). The code is the Act; each feature `README.md` is its live trail. There is **no `frds/` folder in the build**.
3. When the feature ships, move the card to **Done**. Update `../architecture/playbook/playbook-base.md`/`../architecture/adrs/` if the work produced rules or decisions worth keeping.

## Archiving delivered work

Don't delete delivered cards or closed milestones — **move them to `archived/`**. Before archiving, extract any non-ADR durable decision into an ADR (`../architecture/adrs/`). `archived/` is dead storage: it keeps the roadmap board clean without losing the trail.

## Card file template

See the Templater snippet at `.obsidian/templates/spec-template.md` (run via Templater command palette, choose `roadmap` as the stage). It generates a card file with: id, slug, status, kind, the one-way `epic:`/`frd:`/`sdd:` refs, why, outcome, dependencies, estimate.

## Reading order for a fresh agent session

1. `_dashboard/board.md` — what's in flight right now.
2. `milestones/` — the active delivery grouping and the SDDs/epics it delivers.
3. The card file(s) in **In Progress** — context for the current work.
