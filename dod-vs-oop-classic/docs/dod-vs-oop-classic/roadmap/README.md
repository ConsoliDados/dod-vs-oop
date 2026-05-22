# Roadmap

Source of truth for **commitments** — work that has been decided and will (or is) happen(ing). Distinct from `backlogs/`, which is **ideas**.

## Layout

```
roadmap/
├── _dashboard/
│   └── board.md          ← Obsidian Kanban view; columns: Initial / In Progress / Done
├── <id>-<slug>.md        ← per-card file with planning notes
└── README.md             ← this file
```

## Workflow

1. A card from the backlog gets **promoted** to the roadmap once the work is decided to happen. Move the card's file into `roadmap/<id>-<slug>.md` (rename ID prefix as needed) and add it to the kanban under **Initial**.
2. When work starts, move the card to **In Progress** and create a sprint-and-feature pair under `../sprints/<sprint>/features/<id>-<slug>/`. Each feature uses the RPA pattern: `research.md` → `plan.md` → `act.md`.
3. When the feature ships, move the card to **Done**. Update `../architecture/playbook/playbook.md`/`../architecture/adrs/` if the work produced rules or decisions worth keeping.

## Card file template

See the Templater snippet at `.obsidian/templates/spec-template.md` (run via Templater command palette, choose `roadmap` as the stage). It generates a card file with: id, slug, status, why, outcome, dependencies, estimate.

## Reading order for a fresh agent session

1. `_dashboard/board.md` — what's in flight right now.
2. The card file(s) in **In Progress** — context for the current work.
3. `../roadmap.md` is **not** present at this tier; the dashboard is the roadmap.
