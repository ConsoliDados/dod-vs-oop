# Roadmap

Source of truth for **commitments** — work that has been decided and will (or is) happen(ing). Distinct from `backlogs/`, which is **ideas**.

## Layout

```
roadmap/   (= the production esteira: committed work, tracked at 3 levels — flat, ref-based)
├── 00-dashboard/
│   ├── 00-dashboard.md          ← Dataview overview (milestone→epic→feature × status), one pane
│   ├── 01-milestones.board.md   ← kanban: Planned · Active · Shipped
│   ├── 02-epics.board.md        ← kanban: Planned · Active · Done · Parked
│   └── 03-features.board.md     ← kanban: Todo · Doing · Review · Done
├── 01-milestones/   <NNN>-<slug>.md   ← milestone cards (e.g. 001-bootstrap.md)
├── 02-epics/        <NNN>-<slug>.md   ← epic cards (+ README = epic conventions)
├── 03-features/     <NNN>-<slug>.md   ← feature cards (card + live trail; ref epic + frd)
└── README.md                          ← this file
```

Containment is by **reference** (a card's `milestone:`/`epic:` frontmatter), not by folder nesting — short greppable paths, re-parent = a field edit, hierarchy rendered in `00-dashboard.md`.

## Milestones

A **Milestone** is a roadmap-level delivery grouping — the construct that replaces the dead "phase" (playbook §22.1, §25). It is **management, not a doc**: it spans **1..N SDDs/epics plus cross-cutting work** (Milestone : SDD = 1 : N — a milestone like "auth" groups several domains; cross-cutting/infra work sits in a milestone with **no** SDD) and **references** the SDDs/epics it delivers. The reference is one-way (milestone → docs/epics); the docs never point back.

Create one with the Templater snippet `.obsidian/templates/milestone-template.md` (lands under `milestones/<id>-<slug>.md`). In planning, the question per domain is *"does this domain have an SDD yet? no → create one"*; cross-cutting work enters the milestone without an SDD.

**Milestone ↔ Epic naming.** A milestone spanning **one** epic is **1:1** and **takes that epic's slug** — don't invent a redundant name (a lone `ledger-core` epic → milestone `ledger-core`). A milestone spanning **2+** epics gets its **own** deliverable name (`bootstrap` = scaffold + active-foundation). IDs are independent sequences — only the *slug* is shared in the 1:1 case (`MILESTONE-00X` and `EPIC-00Y` can differ in number). If a 1:1 milestone later grows a second epic, rename it to a grouping name.

Portability (playbook §25): a Milestone maps to a Jira Initiative / Linear Project.

## Workflow

1. A card from the backlog gets **promoted** to the roadmap once the work is decided to happen. Move the card's file into `roadmap/<id>-<slug>.md` (rename ID prefix as needed) and add it to the kanban under **Initial**. Set its `epic:` (and, if known, `frd:`/`sdd:`).
2. When work starts, move the card to **In Progress**. The card belongs to an **Epic** (which references one **SDD** — a domain — via `sdd:`, or none if cross-cutting) and is realized by one **Feature** (1:1 with one **FRD**). If the FRD doesn't exist yet, author it as the flat file `../architecture/frds/frd-<slug>.md` (RPA is a mental discipline — one artifact, no `research.md`/`plan.md` siblings). Then create the **feature card** `03-features/<NNN>-<slug>.md` (references the FRD via `frd:` and the epic via `epic:`). The code is the Act; the feature card is its live trail. There is **no `frds/` folder in the build** — the FRD spec stays in `architecture/frds/`. (Scrum/Mode A with `sprints/` is the documented alternative — playbook §23.)
3. When the feature ships, move the card to **Done**. Update `../architecture/playbook/playbook-base.md`/`../architecture/adrs/` if the work produced rules or decisions worth keeping.

## Archiving delivered work

Don't delete delivered cards or closed milestones — **move them to `archived/`**. Before archiving, extract any non-ADR durable decision into an ADR (`../architecture/adrs/`). `archived/` is dead storage: it keeps the roadmap board clean without losing the trail.

## Card file template

See the Templater snippet at `.obsidian/templates/spec-template.md` (run via Templater command palette, choose `roadmap` as the stage). It generates a card file with: id, slug, status, kind, the one-way `epic:`/`frd:`/`sdd:` refs, why, outcome, dependencies, estimate.

## Reading order for a fresh agent session

1. `00-dashboard/` — the kanban boards (milestone/epic/feature) + the Dataview overview — what's in flight right now.
2. `milestones/` — the active delivery grouping and the SDDs/epics it delivers.
3. The card file(s) in **In Progress** — context for the current work.
