# Roadmap dashboard

The production **pipeline** — `milestone → epic → feature`, by status. Drag-drop lives in the
kanban boards (`01-milestones.board.md`, `02-epics.board.md`, `03-features.board.md`); this note
is the **live overview** (Dataview, reads each card's frontmatter). One pane, all three levels.

## Milestones

```dataview
TABLE WITHOUT ID file.link AS Milestone, status, target_window AS window
FROM "roadmap/01-milestones"
WHERE file.name != "README"
SORT file.name ASC
```

## Epics

```dataview
TABLE WITHOUT ID file.link AS Epic, status, milestone, type
FROM "roadmap/02-epics"
WHERE file.name != "README"
SORT file.name ASC
```

## Features

```dataview
TABLE WITHOUT ID file.link AS Feature, status, epic, frd
FROM "roadmap/03-features"
WHERE file.name != "README"
SORT file.name ASC
```

> The tables populate from card frontmatter (`status`, `milestone`/`epic`, `frd`, `type`). Keep
> those fields set on every card. Containment is by **reference** (`milestone:`/`epic:`), not by
> folder nesting — so re-parenting is a field edit, and the hierarchy is rendered here, not pathed.
