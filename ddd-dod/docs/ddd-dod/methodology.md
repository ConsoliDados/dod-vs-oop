# Methodology — DDD DOD

Operating guide for working in this project. Read this top-to-bottom on Day 1, then keep it open as a reference.

This is the **narrative** companion to:

- `AGENTS.md` (repo root) — **declarations** for this project: tier, feature placement mode, active artefacts.
- `architecture/playbook/playbook-base.md` — **normative rules** (code shape, errors, naming, branching, releases).
- `architecture/playbook/playbook-ts.md` — **stack-specific** rules for ts.

If anything here conflicts with `playbook-base.md`, the playbook wins. Flag the discrepancy.

---

## 0. Language convention (read first)

This template officially supports **English** (default) and **Brazilian Portuguese** (`pt_BR`, override). Before writing anything in this project:

- **Code and code-comments** are always in **English**. Non-negotiable. This includes identifiers, doc-comments, log/error messages, commit messages, branch names, file/folder names. The one exception is identifiers that reference untranslatable `pt_BR` domain terms (`cpf`, `cnpj`, `boleto`) — see §24.3 in the playbook.
- **Documentation** defaults to **English**. `pt_BR` is acceptable only when team / client / project constraints justify the override, **and** that choice is declared in `AGENTS.md` → Methodology → `Documentation language`. Mixed-language drift without a declared override is the failure mode this rule prevents.
- **Untranslatable `pt_BR` domain terms** (`CPF`, `CNPJ`, `Boleto`, `Pix`, `LGPD`, `Nota Fiscal`, `ICMS`, etc.) **stay in Portuguese** in both code and docs. Add an English gloss in parentheses on first use.

If a session ever tells you that the project's directive is to write docs in `pt_BR` without `AGENTS.md` declaring it: that's a fabrication. Verify against `AGENTS.md` and `playbook-base.md` §24, then push back.

See `playbook-base.md` §24 for the full rule.

---

## 1. The shape

Three orthogonal axes describe how this project operates. The current values live in `AGENTS.md` → **Methodology** section. Treat the table below as the legend for those values.

### 1.1 Tier — formality level

| Tier | Use when | Key artefacts |
|---|---|---|
| **prototype** | POCs, throwaway tools, single-dev experiments | flat `roadmap.md`, `backlog.md`, `epics.md`, `srs+sad.md` combined |
| **small** | MVPs without DDD ceremony; informal sprints | kanban directories, `sdds/` optional, `srs+sad.md` still combined |
| **medium** | Real MVPs with DDD strategic + tactical | `srs.md` + `sad.md` split, `data-model.md` optional, separate sprint `planning.md` |
| **large** | Multi-app / multi-team products with billing-critical flows | `data-model.md` required, `dev-pipeline/` for governance, multi-app SAD |

Promotion is monotonic — every tier contains the previous tier's artefacts. See `playbook-base.md` §21.

### 1.2 Feature placement mode — where features physically live

| Mode | Layout (feature-keyed; the FRD spec stays in `architecture/frds/`) | Best for |
|---|---|---|
| **A — sprint-bound** | `sprints/sprint-NN/features/<feature-slug>/` | 3+ contributors, capacity-driven |
| **B — epic-bound** (project default) | `epics/<epic-id>-<slug>/features/<feature-slug>/` | 1–2 contributors, kanban-flow |
| **C — flat** | `features/<feature-slug>/` | prototype with flow discipline |

Bidirectional, non-destructive promotion: move folders + update frontmatter. See `playbook-base.md` §23.

### 1.3 Promotion triggers — when "optional" becomes "required"

| Artefact | Triggered when |
|---|---|
| **SDD** for a context (flat file, referenced by its epic) | 3+ ADRs on that context **or** 5+ public use cases **or** 3+ aggregate roots |
| **FRD** split out of its SDD (flat file, 1:1 with a Feature) | fine validation rules / acceptance criteria beyond the SDD's invariants **or** its own Tasks breakdown worth pinning **or** needs an isolated parallel scope (absorbed in the SDD at prototype/small) |
| **`data-model.md`** | versioned migrations **or** 2+ entities with cross-table invariants **or** public schema |
| **`dev-pipeline/`** | 3+ contributors **or** multi-app shared SAD **or** recurring doc-merge conflicts |
| **`threat-model.md`** | untrusted input **or** sensitive data **or** compliance regime applies |
| **Per-module `AGENTS.md`** | 5+ public items **or** second contributor edits the module |
| **Outbox pattern** | event loss is unacceptable (billing, audit, compliance) |

When a trigger fires, log it in `open-questions.md` (resolved) or the active epic's progress log. See `playbook-base.md` §22.

---

## 2. The lifecycle

Two axes, one-way reference. The **management esteira** (roadmap/board) points *into* the **docs** (`architecture/`); the docs are agnostic and never point back. FRD is the last doc; below it is code.

```
   ESTEIRA DE GESTÃO                      aponta p/         DOCS (architecture/, agnósticos)
   (roadmap / board)                                        ───────────────────────────────
   ROADMAP
     │
     ▼
   MILESTONE ───────────── refs ─────────▶  vários SDDs  (1 : N)   "auth", "workflow IA"
     │   no planejamento: "esse domain tem SDD? não → cria"        cross-cutting entra sem SDD
     ▼
   EPIC ─────────────────── sdd: ────────▶  SDD   (≈1 : 1)   domínio: core | supporting | generic
     │   (ou SEM sdd, se cross-cutting)                      1 artefato: sdd-<slug>.md (flat)
     ▼
   FEATURE ──────────────── frd: ────────▶  FRD   (1 : 1)    1 funcionalidade
     │                                                       1 artefato: frd-<slug>.md (flat)
     ▼
   TASK  (menor unidade = DIAS, 1–2d)
     │   checklist interno = HORAS
     ▼
   CÓDIGO  ◀──── o "Act" do build ────  (+ README da Feature = trilha viva; sem act.md)
     │
     └── decisão durável ──────────────▶  ADR   (única coisa do "research" que persiste)
```

The cardinality ruler (playbook §22.1):

| Pair | Cardinality | Note |
|---|---|---|
| Milestone : SDD | 1 : N | a milestone spans several domains; cross-cutting/infra work sits in a milestone with **no** SDD |
| Epic : SDD | ≈ 1 : 1 | a domain epic references one SDD via `sdd:`; a cross-cutting epic references none |
| Feature : FRD | 1 : 1 | a Feature **is** the realization of one FRD |
| Task | = DAYS (1–2d) | smallest management unit; internal checklist = HOURS. XP/kanban-flow, not Scrum |

**Mode B/C collapse**: sprint planning becomes a section in the active epic's README; the "sprint" box disappears; features go straight from epic → code.

**Tier collapse**: at `prototype` the SDD **and** FRD are absorbed into `srs+sad.md` (§3) and features are flat (Mode C). At `small` the SDD is a flat file `sdds/sdd-<slug>.md` but the FRD stays absorbed in the SDD's "Functionalities" section, so the build is feature-keyed. FRDs split out into their own flat file `architecture/frds/frd-<slug>.md` at `medium`+; the build stays feature-keyed (`features/<feature-slug>/`).

**RPA is a mental discipline, not files** — see §4. Each node yields exactly one artifact (the flat `sdd-<slug>.md`, the flat `frd-<slug>.md`, or the Feature's code + `README.md`). No `research.md`/`plan.md`/`act.md` by default; durable decisions go to ADRs.

---

## 3. Day 1 — joining this project

Read in this order. Resist the urge to skim.

1. **`AGENTS.md`** (repo root) — declarations: tier, mode, sprint planning placement, active artefacts. **The most project-specific document.**
2. **`docs/ddd-dod/architecture/playbook/playbook-base.md`** — language-agnostic rules. §21 (layered table), §22 (promotion triggers), §23 (modes), §24 (**language convention** — non-negotiable for code; declarable for docs), §25 (portability).
3. **`docs/ddd-dod/architecture/playbook/playbook-ts.md`** — stack-specific examples and idioms.
4. **`docs/ddd-dod/architecture/sad.md`** (or `srs+sad.md` at prototype/small) — architecture overview. Get the context map and cross-cutting concerns.
5. **`docs/ddd-dod/architecture/srs.md`** (medium+) — requirements contract.
6. **`docs/ddd-dod/architecture/adrs/`** — locked-in decisions. Skim titles; read those touching the area you'll work in.
7. **`docs/ddd-dod/architecture/sdds/`** (when present) — flat files `sdd-<slug>.md`, the tactical design per bounded context (the domain bible an epic references). **`architecture/frds/`** (medium+) — flat files `frd-<slug>.md`, the "what" of each functionality.
8. **`docs/ddd-dod/roadmap/`** — the production esteira. `00-dashboard/` (kanban boards + Dataview overview) shows what's Active; open the active epic in `02-epics/` (follow its `sdd:` to the domain bible).
9. **`docs/ddd-dod/roadmap/03-features/`** — feature cards = current build trails (the code is the Act, in `apps/`/`packages/`). (Scrum/Mode A with `sprints/` is the documented alternative — playbook §23.)
10. **`docs/ddd-dod/open-questions.md`** — unresolved decisions that may block progress.

By the end of Day 1 you should be able to answer:

- What tier and mode is this project? (from AGENTS.md)
- What's the active epic, and what are its `exits_with`?
- Who's working on what right now?
- What's the next card to pick up?

---

## 4. Day N — the loop

**RPA is a mental discipline, not a set of files.** At every node you Research (read the SAD/ADRs/SRS/parent-SDD) → Plan (outline in your head or a scratchpad) → Act (write the doc, or build the code). The discipline produces **exactly one artifact per node**:

- authoring a domain → the flat `architecture/sdds/sdd-<slug>.md`;
- authoring a functionality → the flat `architecture/frds/frd-<slug>.md`;
- building → the Feature's **code (the Act)** + its `README.md` (the live trail).

There are **no** persisted `research.md`/`plan.md`/`act.md` files by default — everything durable already has a home: a **durable decision → ADR**; the design → the SDD/FRD itself; the task breakdown → the FRD's Tasks, pulled into the feature README checklist (transient); the provenance → git history. **Rare-audit exception:** when it genuinely matters to record *what* the AI evaluated and *how* (audit / sensitive handoff), promote that one node to a folder and keep a single `research.md` (plan folded inside) next to the doc. Default = no research file.

### 4.1 Orient + author the spec (RPA in your head → one artifact)

1. Confirm the card is in **Initial** on the roadmap kanban. Move it to **In Progress**. The card belongs to an **Epic** (which references one **SDD** — a domain) and is realized by one **Feature** (1:1 with one **FRD** — a functionality).
2. If the **SDD** doesn't exist yet (or needs extending), author it as the flat file `architecture/sdds/sdd-<slug>.md`: Research (SAD + related ADRs + SRS) → Plan (aggregates, entities, behaviors, the behavioral endpoint table) → Act (write the SDD). Set `subdomain-type: core | supporting | generic`. Routes expose use-case/intent, not status patches (playbook §6.1). No siblings — the SDD *is* the artifact.
3. Author the **FRD** as the flat file `architecture/frds/frd-<slug>.md` (medium+; at prototype/small it's a block inside the SDD): Research (the parent SDD + SAD + SRS) → Plan → Act (intent, acceptance criteria, validation rules, the **Tasks** 1–2 day breakdown, behavioral API surface). The FRD *references* the SDD (`sdd:`); it never duplicates the model and carries no `epic:`/`milestone:` field.
4. If you can't decide between approaches while authoring, surface an **ADR candidate** in `open-questions.md` or draft the ADR directly — the spec can't proceed without the decision, and the ADR is the only part of the "research" that persists.

### 4.2 The Feature realizes the FRD (1:1)

A **Feature** is the realization of one **FRD** (1:1). Its build folder holds a `README.md` (the live trail) and the code. The FRD's **Tasks** section lists the 1–2 day units — pull them into the README as a `- [ ]` checklist. Create the build folder with the Templater snippet `feature-template.md` (feature build dir = `sprints/sprint-NN` in Mode A; the epic path in Mode B; `flat` in Mode C). There is **no `frds/` folder in the build** — the FRD spec stays in `architecture/frds/`.

### 4.3 Build the feature (the Act is the code)

1. Branch: `git checkout dev && git pull && git checkout -b feat/<slug>`.
2. The feature `README.md` is the **live tracker**: pull the FRD's Tasks (handler, aggregate method, endpoint, tests) in as a `- [ ]` checklist, check them off as work happens, capture surprises and punted items inline (and *why*).
3. Each task maps to a specific file/operation in the SDD and an acceptance criterion from the FRD.
4. If a non-trivial decision is locked in mid-build, write the **ADR** now. No `research.md`/`plan.md`/`act.md` — the code is the Act and the README is the trail (rare-audit exception aside, §4 intro).

### 4.4 Close the feature

At feature end, write the closing retro block at the bottom of the feature `README.md` (there is no separate `act.md` — the README + code carry the trail):

```markdown
## Retro

**Shipped:** <list>
**Punted:** <list>  →  <where they went: backlog / next sprint / dropped>
**Surprises:** <list>
**Carry forward:** <patterns or follow-ups for the next feature / FRD>
```

### 4.5 Code & push

- Conventional Commits per `playbook-base.md` §16.1: `feat(<scope>): ...`, `fix(<scope>): ...`.
- Multiple small commits are fine; they will squash on merge.
- `git push -u origin feat/<slug>`. **Do not open the PR yet.**

### 4.6 Pause for human validation

The human pulls the branch locally, reviews code + docs, runs the feature. They request changes or approve.

In Mode B with one contributor, "pause for human validation" still applies — the contributor is the reviewer of their own work, and the pause exists for that re-read.

### 4.7 PR → merge

- `gh pr create --base dev --title "feat(<scope>): ..." --body "..."`
- CI must pass.
- Squash-merge to `dev`.

### 4.8 Close out

- Roadmap card → **Done** on kanban.
- Append to the active epic's `## Progress log`: `<date> — <one-line outcome>`.
- Tick any `exits_with` items now satisfied.
- DoD gate: walk the AGENTS.md checklist. Every applicable box ticked, or the card stays open.
- If the epic's `exits_with` is now fully ticked → epic to **Done** → release (see §5).

---

## 5. Release on epic close

Triggered by epic closure, not by calendar. Per `playbook-base.md` §16.4:

```sh
# Pre-conditions
# - CI green on dev HEAD
# - epic.exits_with all checked
# - CHANGELOG.md updated for the entries since the last tag

git checkout main && git pull
git merge --no-ff dev -m "release: EPIC-<id> <slug>"
git tag -a v<X>.<Y>.<Z> -m "EPIC-<id>: <slug>"
git push origin main --tags
```

**Semver**:

- Scaffolding epic (`bootstrap`, `type: infra`) → `v0.1.0`.
- Capability epics, pre-1.0 → minor bump.
- Refactor/infra without public surface change → patch.
- First production release → `v1.0.0` (product decision).

**Hotfix**: branch `hotfix/<slug>` off `main`, patch bump, cherry-pick back to `dev`.

---

## 6. Operations playbook (common recipes)

Quick reference for routine actions. None of these need a meeting.

### 6.1 New idea
Templater → `spec-template.md` → stage `backlog` → fill `why`, `outcome`, `dependencies`, `cost`. Kanban: **Initial**.

### 6.2 Promote backlog → roadmap
Move file from `backlogs/<id>-<slug>.md` → `roadmap/<id>-<slug>.md` (rename ID prefix `BACKLOG-NNN` → `ROADMAP-NNN`). Update kanban entries. Set `epic:` field.

### 6.3 Start a new epic
Templater → `epic-template.md` → fill `why`, `outcome`, `scope`, `exits_with`. Set `sdd:` to the one SDD this epic delivers (or leave blank if cross-cutting). Kanban: **Planned**. Move to **Active** when a sprint commits to it (Mode A) or when the first feature lands inside (Mode B/C).

### 6.3b Create a Milestone
Templater → `milestone-template.md` → lands under `roadmap/01-milestones/<NNN>-<slug>.md`. A milestone is a **management** delivery grouping that spans 1..N SDDs/epics plus cross-cutting work (Milestone : SDD = 1 : N). Fill the window, the SDDs/epics it delivers (by ref), cross-cutting items, and the exit. It references docs; docs never point back.

### 6.4 Close an epic
Verify all `exits_with` checked. Move kanban entry to **Done**. Follow §5 (release).

### 6.5 Create an ADR
Templater → `adr-template.md` → fill `Context / Decision / Alternatives / Consequences`. Status: `Draft`. Cross-link from the SAD / SDD section that prompted it. Move to `Accepted` when the corresponding code lands.

### 6.6 Create an SDD (= a coherent domain bible)
Templater → `sdd-template.md` → lands as the flat file `sdds/sdd-<slug>.md` (no folder, no siblings). **Identity = the slug — no `SDD-NNN` id** (slugs are merge-safe with many contributors; an epic refs it via `sdd: <slug>`). Set `subdomain-type: core | supporting | generic`. Fill `Aggregates / Use cases / Invariants / Errors / Ports / Behavioral API surface / Functionalities (child FRDs)`. The doc is **agnostic** — no `epic:` field. Author via RPA in your head (the SDD is the one artifact). Cross-link from `sad.md` and from each ADR that touches the context. **At large**, when the context subdivides, this becomes a folder `sdds/sdd-<context>/{sdd-<context>.md + sdd-<sub>.md …}` of nested sub-SDDs (playbook §22.1).

### 6.6b Create an FRD (= one functionality, 1:1 with a Feature)
FRDs are a **list inside the SDD** (§8 "Functionalities") by default; splitting one into its own file is the medium+ §22 **option**, not the norm. When you do split: Templater → `frd-template.md` → lands as the flat file `frds/frd-<slug>.md`. **Identity = the slug — no `FRD-NNN` id** (the Feature card refs it via `frd: <slug>`). Set `sdd:` to the parent bible **slug**; no `epic:`/`milestone:` field. Fill intent + inherited domain context + acceptance criteria + validation rules + the **Tasks** (1–2 day units) + behavioral API surface + out of scope. Then create its Feature card per §4.2.

### 6.7 Surface an open question
Append to `open-questions.md` under `## Active` with a stable ID `OQ-NNN`. When resolved, move to `## Resolved` with a link to the ADR / SDD / commit.

### 6.8 Promote tier (e.g. small → medium)
Copy missing artefacts from the next-tier template directory. Update `AGENTS.md` → Methodology section. Log the promotion in `open-questions.md` (resolved) or the active epic's progress log.

### 6.9 Switch placement mode (e.g. A → B)
Move the **feature** build folders (`features/<feature-slug>/`); the FRD spec stays put in `architecture/frds/`. Update each feature README's `mode:` frontmatter (the `frd:` link never changes). Document the switch in `AGENTS.md` → Methodology section.

### 6.10 Bootstrap exception ends
When `EPIC-001 — bootstrap` reaches `status: done`, the playbook §16.3 per-feature workflow becomes mandatory. Create `.bootstrap-complete` (or repo tag) so commit hooks enforce it. Tag the release as `v0.1.0`.

---

## 7. When in doubt — decision FAQ

### Do I need to write an ADR?

Yes if any of:

- The decision changes a default that affects security or data integrity.
- You're adding a new external dependency (non-trivial transitive deps, new system requirement).
- The public surface changes (API, CLI, schema).
- You're picking between approaches with lasting trade-offs.

No if: the decision is local to a single function, easily reversible, or a routine implementation choice.

See `playbook-base.md` §18.

### Do I need to write an SDD for this context?

The SDD is the agnostic bible of a **coherent domain** (one bounded context); an Epic *references* it via `sdd:` (Epic : SDD ≈ 1 : 1). Cross-cutting `refactor`/`infra` epics reference no SDD (playbook §22.1). For a domain context, write it as the flat file `sdds/sdd-<slug>.md` when any of (`playbook-base.md` §22):

- 3+ ADRs already touch this context.
- 5+ public use cases live here.
- 3+ aggregate roots.
- Non-trivial cross-aggregate invariant.

No if: the context is small and stable (keep tactical notes inline until the trigger fires).

### Do I need a separate FRD, or keep it in the SDD?

Split a functionality into its own flat **FRD** (`architecture/frds/frd-<slug>.md`) when any of:

- It has **fine-grained validation rules / acceptance criteria** that don't fit the SDD's invariants.
- It has its own **Tasks** breakdown (the 1–2 day units) worth pinning separately.
- You want to hand it to a dev/AI agent as an **isolated, parallelizable scope**.

Otherwise keep it as a block in the SDD's "Functionalities" section. At **prototype/small** the FRD is always absorbed in the SDD (or `srs+sad.md` at prototype). One SDD lists 1..N functionalities; each split FRD is **1:1 with the Feature** that realizes it.

### Should I split this work into a sprint, or just do it?

If you're in Mode B/C: don't split. Work flows through the active epic.

If you're in Mode A and the work spans 2+ days of focused effort: yes, plan it as a sprint card. Otherwise: track it under the current sprint as an unplanned task.

### Should this work be its own epic?

Yes if it spans **2+ sprints** (Mode A) or **multiple features** (Mode B/C) and has a coherent outcome. The epic's `exits_with` becomes the contract.

No if it's a single feature or a routine fix.

### Is this a bug, feature, refactor, or infra?

- **Bug**: existing behavior is wrong. Fast-track allowed (skip refining).
- **Feature**: new user-visible value.
- **Refactor**: internal quality improvement, no behavior change. Public surface stays.
- **Infra**: CI/CD, observability, dev tools.

Reflected in card frontmatter `kind:` field. Bugs in production may follow the §16.4 hotfix path; everything else follows the normal flow.

### Where do I document a workaround?

If it's a TODO in code → add a matching entry in `open-questions.md` under `## Active`. The playbook forbids orphan `TODO`/`FIXME`.

If it's a temporary architectural compromise → an ADR with status `Draft` is fine; promote to `Accepted` when the workaround becomes intentional, or write a new ADR retiring it when the workaround is removed.

### When does the bootstrap exception end?

When `EPIC-001 — bootstrap` reaches `status: done` (its `exits_with` are all checked). Typically when the first domain-logic card is ready to be worked on. See §6.10 above.

---

## 8. Cross-references

| When you need to … | Read … |
|---|---|
| Look up a code-shape rule | `playbook-base.md` §1–§20 |
| Decide on tier-conditional artefact | `playbook-base.md` §21 |
| Decide if an optional artefact must be promoted | `playbook-base.md` §22 |
| Pick / switch feature placement mode | `playbook-base.md` §23 |
| Know the language convention (code vs docs) | `playbook-base.md` §24 |
| Map a concept to Jira / Linear / GH Projects | `playbook-base.md` §25 |
| See what this project's choices are | `AGENTS.md` § Methodology |
| Know which conventions apply when entering a module | `<module>/AGENTS.md` |
| Find the domain bible for a context (referenced by its epic) | `architecture/sdds/sdd-<slug>.md` (or the SAD) |
| Find the "what" of a functionality (1:1 with its Feature) | `architecture/frds/frd-<slug>.md` (medium+; in the SDD's "Functionalities" section at prototype/small) |
| Find the source of truth for a decision | `architecture/adrs/<NNNN>-<slug>.md` |
| Track unresolved decisions | `open-questions.md` |
| Know what's being done now | `roadmap/00-dashboard/` (boards + Dataview overview) |

If a question isn't covered here or in the playbook, raise it in chat and update this doc once resolved. **Methodology drift is bigger than code drift — catch it early.**
