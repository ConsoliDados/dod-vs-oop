# Epics

Multi-sprint groupings of work. An epic spans more than one sprint and has its own completion criteria (`exits_with`). Distinct from `../roadmap/` (single-card commitments) and `../backlogs/` (ideas).

In the management chain **Milestone → Epic → Feature → Task**, the Epic sits below a roadmap **Milestone** (a delivery grouping; see `../roadmap/`) and above the Features that realize it (one Feature = one FRD, 1:1).

## Layout

```
epics/
├── _dashboard/
│   └── board.md          ← Obsidian Kanban; columns: Planned / Active / Done / Parked
├── <id>-<slug>.md        ← per-epic file (one flat file per epic at this tier)
└── README.md             ← this file
```

In `large` tier, an epic may promote to its own folder (`<id>-<slug>/README.md` + `notes/`, `figures/`). At `medium` a flat file is enough.

## Types

Each epic declares a `type` in its frontmatter:

- **capability** — themed body of product work (`authentication`, `billing`).
- **refactor** — quality / restructuring (e.g., "extract auth into its own crate").
- **infra** — CI/CD, observability, dev tools. (The scaffolding epic `EPIC-001 — bootstrap` is `type: infra`.)

Temporal grouping — `bootstrap`, `MVP`, `v1` — is **not** an epic type: it's a **Milestone** (a roadmap-level delivery grouping; see `../roadmap/`). A Milestone spans 1..N epics/SDDs (Milestone : SDD = 1 : N).

### Epic references an SDD (it does not equal one)

An **Epic references one SDD** via its `sdd:` field — it is *not* the same object as the SDD (Epic : SDD ≈ 1 : 1). A **domain** epic (`capability`) references exactly one bounded context — its agnostic tactical bible, the flat file `../architecture/sdds/sdd-<slug>.md`; its functionalities are **FRDs** (`../architecture/frds/frd-<slug>.md`, 1:1 with the Features that realize them). Set the epic's `sdd:` field to that SDD's ID. A **cross-cutting** epic (`refactor`, `infra`) has no bounded context — leave `sdd:` blank. The reference is one-way: the epic points at the SDD; the SDD (agnostic, no `epic:` field) never points back (playbook §22.1).

## Workflow

1. **Plan** — Create the epic file via Templater (`.obsidian/templates/epic-template.md`). Fill in `why`, `outcome`, `scope`, `exits_with`, and link the ADRs/SDDs you anticipate touching. Add to the kanban under **Planned**.
2. **Activate** — When a sprint commits to advancing this epic, move to **Active** and set the sprint's `active_epic:` to point here.
3. **Track** — Roadmap cards belonging to this epic carry `epic: <id>-<slug>` in their frontmatter. Sprint READMEs list `active_epic:`. Progress log appended in epic file as cards close.
4. **Close** — When all `exits_with` are checked, move to **Done**. Per playbook §16.4, epic closing triggers a `dev → main` release (semver bump, tag, changelog entry).
5. **Park** — Use **Parked** for epics deferred indefinitely. Document the parking reason in the epic file.

## Relationship to other artefacts

```
Backlog (ideas)
    ↓ promote
Roadmap (commitments)         epic: <id>-<slug>   ← roadmap cards reference an epic
    ↓ select for sprint
Sprint (execution)            active_epic: <slug> ← sprint serves one (or few) epic(s)
    ↓ Feature (1:1 FRD) → Tasks (1–2 day units)
ADRs / SDD (epic's `sdd:`) / FRDs   related_decisions:  ← the SDD is the domain bible the epic references; FRDs are its functionalities
    ↓ exits_with all checked
Epic → Done → release (playbook §16.4)
```

## Parallel epics

Multiple capability epics can run in parallel sprints, but a single sprint should have at most one `active_epic` to keep focus. Cross-epic dependencies live in card frontmatter (`dependencies:`) and risks log of each epic.

## Hosting features inside an epic (Mode B)

When the project runs **Feature Placement Mode B — epic-bound** (playbook §23), features live under the epic rather than under sprints. This is the canonical mode for 1–2 contributor `medium` projects without time-boxed sprints:

```
epics/
└── <id>-<slug>/                          ← the epic (references one SDD via `sdd:`)
    ├── README.md                         ← the epic; frontmatter: sdd: sdd-<slug>
    └── features/<feature-slug>/README.md ← build, feature-keyed (1 Feature = 1 FRD, 1:1)
                                           ←   frontmatter: frd: frd-<slug>
                                           ←   the FRD spec stays in ../architecture/frds/
                                           ←   the README is the live trail; the CODE is the Act
```

The build is **feature-keyed**: there is **no `frds/` folder in the build** and **no `act.md`** — the FRD *spec* lives in `../architecture/frds/frd-<slug>.md`.

In Mode B:
- `sprints/` stays empty or absent.
- `sprint-planning` collapses into a "Planning" section inside the epic `README.md` (capacity, picks, risks for the *next* features to advance).
- The kanban entry still points at the folder via `[[<id>-<slug>/README|<id> — <name>]]`.
- Promote to Mode A by moving features into a new `sprints/sprint-NN/features/` when the project gains a third contributor or starts needing capacity time-boxes.

## Card file template

See `.obsidian/templates/epic-template.md`.
