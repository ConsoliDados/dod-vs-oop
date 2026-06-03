# Backlogs

Source of truth for **ideas** — things we *could* do, not things we've committed to. Promotion to `../roadmap/` is what turns an idea into a commitment.

## Layout

```
backlogs/
├── _dashboard/
│   └── board.md          ← Obsidian Kanban; columns: Initial / Refining / Ready
├── <id>-<slug>.md        ← per-card file with preliminary planning notes
└── README.md             ← this file
```

Column meanings:

- **Initial** — raw idea, not yet refined.
- **Refining** — being researched / scoped / costed.
- **Ready** — refined enough to commit; next step is promotion to `roadmap/`.

## Workflow

1. New idea → `backlogs/<id>-<slug>.md` + entry under **Initial** in `_dashboard/board.md`.
2. As you refine the idea (research, scoping), update the card file and move it to **Refining**.
3. When the idea is ready to commit, move it to **Ready**. The next decision point is whether to promote to `roadmap/` (yes → move file + kanban entry) or drop (delete or archive).

## Card file template

See the Templater snippet at `.obsidian/templates/spec-template.md` (choose `backlog` as the stage).

## Why two kanbans (backlog + roadmap)?

- **Backlog** is the *ideation* funnel. Cards here are speculative; they may never be done.
- **Roadmap** is the *execution* funnel. Cards here are commitments with target outcomes.

Mixing the two leads to "everything is a TODO forever". The handoff (Ready → Initial in roadmap) forces an explicit *yes, we will do this*.
