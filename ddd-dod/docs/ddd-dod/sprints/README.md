# Sprints

Time-boxed execution units. A sprint contains the **Features being built** in that window and advances one (or few) `epic(s)`. An Epic **references** one SDD (a domain) via `sdd:` (Epic : SDD ≈ 1 : 1); cross-cutting epics reference none.

This directory is the home of **Feature Placement Mode A — sprint-bound** (playbook §23), the default for `medium`+ projects with 3+ contributors. Smaller teams (1–2 people) often run `medium` in **Mode B — epic-bound** (the feature build folder lives under `../epics/<id>-<slug>/features/<feature-slug>/`), where `planning.md` collapses into the epic README and `sprints/` stays empty. Pick at instantiation; the Templater snippet `feature-template.md` routes accordingly.

## Layout

The **FRD spec** (the "what") is the flat file `../architecture/frds/frd-<slug>.md` (1:1 with a Feature). The **build is feature-keyed** — there is **no `frds/` folder in the build**:

```
sprints/
├── sprint-01/
│   ├── README.md                            # sprint goal + scope + retrospective (live)
│   ├── planning.md                          # planning snapshot (frozen at sprint start)
│   └── features/
│       ├── <feature-slug>/README.md         # 1 Feature = 1 FRD (frd: frd-<slug>); the CODE is the Act
│       └── <other-feature-slug>/README.md   # tasks as `- [ ]` checklist, surprises inline, short retro
└── sprint-02/
    └── ...
```

`planning.md` is the sprint-planning artefact — see "How a sprint starts" below.

## RPA is a mental discipline, not files

RPA (Research → Plan → Act) is the discipline for authoring **every node** well — it produces exactly one artifact per node, never a fixed file set:

- The **SDD** and **FRD** are each the **Act** of an authoring pass: Research → Plan → Act = the flat `sdd-<slug>.md` / `frd-<slug>.md`. There are no `research.md`/`plan.md` siblings; durable decisions go to an **ADR** (see `../architecture/sdds/` and `../architecture/frds/`).
- At **build** time the FRD is the closed scope a dev/agent picks up. The **code is the Act**; each feature `README.md` is the **live tracker** — the FRD's Tasks pulled in as `- [ ]` checklists, ticked as work happens, surprises and punted items captured inline, with a short closing retro that feeds the sprint retrospective.
- There is **no `act.md`** and no per-node research/plan files. Features are built **bottom-up & layered** (entity → aggregate + repo + use-cases + services → infra/controllers/routes).

> **Rare-audit exception:** a node spawns a single `research.md` only when an audit / sensitive handoff genuinely needs the record (RARE; default = no research file).

## How a sprint starts

1. Pick cards from `../roadmap/_dashboard/board.md` that are in **Initial** and fit the sprint window. Cards carry `epic:` and, when known, `frd:`/`sdd:`.
2. Move them to **In Progress** in the roadmap board.
3. Create `sprint-NN/planning.md` via the Templater snippet `sprint-planning-template.md`: capacity, justified picks, anticipated risks, what was *not* picked and why. **It freezes at sprint start.**
4. Create `sprint-NN/README.md` with goal + scope + the chosen cards + `active_epic:` (which epic this sprint advances — see `../epics/`).
5. For each Feature in scope, create its build folder `features/<feature-slug>/README.md` with the Templater snippet `feature-template.md` (feature build dir = `sprints/sprint-NN`); set `frd: frd-<slug>`. The FRD spec stays in `../architecture/frds/`.
6. Build each feature bottom-up; the feature `README.md` tracks Tasks; the code is the Act.

## How a sprint ends

1. For each completed FRD/feature, move its roadmap card to **Done** and add a one-line entry under "Done in sprint-NN" in the sprint README.
2. Update the `active_epic`'s progress log (`../epics/<id>-<slug>.md`) with what advanced; check any `exits_with` items now satisfied. Delivered cards/milestones move to `../roadmap/archived/` (never deleted).
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
