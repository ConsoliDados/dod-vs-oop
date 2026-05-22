# Sprints

Time-boxed execution units. A sprint contains the features being worked on in that window and advances one (or few) `epic(s)`.

This directory is the home of **Feature Placement Mode A — sprint-bound** (playbook §23), the default for `medium`+ projects with 3+ contributors. Smaller teams (1–2 people) often run `medium` in **Mode B — epic-bound** (features under `../epics/<id>-<slug>/features/`), where `planning.md` collapses into the epic README and `sprints/` stays empty. Pick at instantiation; the Templater snippet `feature-template.md` routes accordingly.

## Layout

```
sprints/
├── sprint-01/
│   ├── README.md                   # sprint goal + scope + retrospective (live)
│   ├── planning.md                 # planning snapshot (frozen at sprint start)
│   └── features/
│       ├── 001-feature-slug/
│       │   ├── feature.md          # frontmatter + goal + scope
│       │   ├── research.md         # RPA stage 1
│       │   ├── plan.md             # RPA stage 2
│       │   └── act.md              # RPA stage 3 + log
│       └── 002-other-feature/
│           └── ...
└── sprint-02/
    └── ...
```

`planning.md` is the sprint-planning artefact — see "How a sprint starts" below.

## RPA pattern (Spec-kit)

Each feature follows three sequential documents:

1. **`research.md`** — Read prior art, internal docs, external sources. Discuss tradeoffs. Document **what we considered** and **what we decided**. May surface new ADRs or SDD updates.
2. **`plan.md`** — Concrete plan: tasks, file paths, dependencies. May produce a new ADR if a non-trivial choice is locked in. For projects with SDDs, the plan ties tasks to specific operations in the SDD.
3. **`act.md`** — Live task tracker + execution log. Tasks from `plan.md` are pulled here as `- [ ]` checklists and ticked as work happens; surprises, punted items, and inline notes accrue as the feature ships. The closing block of the same file is the per-feature retro, which feeds the sprint retrospective.

The pattern scales: tiny features may collapse `research.md` and `plan.md` into one file; only `act.md` is non-negotiable so the trail exists.

## How a sprint starts

1. Pick cards from `../roadmap/_dashboard/board.md` that are in **Initial** and that fit the sprint window.
2. Move them to **In Progress** in the roadmap board.
3. Create `sprint-NN/planning.md` via the Templater snippet `sprint-planning-template.md`. This captures the planning reasoning: capacity, justified picks, anticipated risks, what was *not* picked and why. **It freezes at sprint start** — it's the historical record.
4. Create `sprint-NN/README.md` with goal + scope + the chosen cards + `active_epic:` (which epic this sprint advances — see `../epics/`).
5. For each card, create `features/<id>-<slug>/feature.md` (use the Templater snippet `feature-template.md`).
6. Work through `research.md` → `plan.md` → `act.md` per feature.

## How a sprint ends

1. For each completed feature, move its roadmap card to **Done** and add a one-line entry under "Done in sprint-NN" in the sprint README.
2. Update the `active_epic`'s progress log (`../epics/<id>-<slug>.md`) with what advanced; check any `exits_with` items now satisfied.
3. Write a brief retrospective at the bottom of `sprint-NN/README.md`: what went well, what didn't, what to change.
4. Items that didn't ship: either return to **Initial** in the roadmap (re-plan next sprint) or back to the **Backlog** (de-commit).
5. If the `active_epic` now has all `exits_with` checked, move the epic to **Done** and follow the release flow (playbook §16.4).

## Sprint README template

```markdown
---
sprint: NN
window: YYYY-MM-DD .. YYYY-MM-DD
status: planned | active | closed
active_epic: <epic-id>-<slug>
---

# Sprint NN

## Goal

<one paragraph; ties back to the active epic's outcome>

## Cards in scope

- [ ] [[../../roadmap/<id>-<slug>|<id> — <slug>]]
- [ ] ...

## Done in this sprint

- ...

## Retrospective

**What went well:**

**What did not:**

**Changes for next sprint:**
```
