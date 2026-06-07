# Feature Requirements Documents (FRDs)

An **FRD** is a domain/bounded-context specialization of a PRD: the **"what"** of *one functionality* inside a domain. It is the child of an **SDD** (the domain bible) and is **1:1** with the management **Feature** that realizes it. **FRD is the last doc in `architecture/`** — below it is code.

```
SRS → SAD (+ADRs) → SDD → FRD          (docs, agnostic)
                            │
Milestone → Epic → Feature → Task      (management, references docs by id)
```

The FRD is **management-agnostic**: it carries **no** `epic:`/`milestone:` field. Its only upward link is `sdd:` (the parent domain bible). It **inherits** that SDD's ubiquitous language, aggregates, and invariants — it *references* them, never duplicates. It pins the **acceptance criteria**, **fine-grained validation rules**, and its **Tasks** (the 1–2 day units). This is what lets a dev or AI agent take a *closed scope* (the SDD as the bible + the FRD as the objective) and work in parallel without colliding on the model.

**Tier behaviour:** at `prototype`/`small` the FRD is **absorbed into the SDD** (§8 of the SDD). It **splits out into its own flat file here at `medium`+**. Promotion trigger in `playbook-base.md` §22 (fine validation / acceptance criteria beyond the SDD's invariants, its own Tasks breakdown worth pinning, or needing an isolated parallel scope).

## Authoring an FRD — RPA is a mental discipline, one flat file

The FRD is a **flat file** `frds/frd-<slug>.md` — the single artifact. RPA (Research → Plan → Act) is the **mental** discipline: Research (pull the parent SDD + SAD + SRS — everything upward that matters) → Plan (acceptance criteria, validation rules, the Tasks breakdown) → Act (write the doc). There are **no** `research.md`/`plan.md` siblings and **no** folder by default. Durable decisions surfaced while authoring go to an **ADR**.

> **Rare-audit exception:** when it genuinely matters to record *what* the AI evaluated and *how* (audit / sensitive handoff), promote that one node to a folder and keep a single `research.md` (the plan folded inside) next to the doc. This case is **RARE but exists; default = no research file.**

## Naming

`frds/frd-<slug>.md`. Example: `frds/frd-cancel-appointment.md`.

## From FRD to the Feature build

The FRD's §5 lists its **Tasks** — the 1–2 day units, built **bottom-up & layered**: entity A · entity B · the aggregate + repository + use-cases + domain/application services · then infra (repository impl, DI, controllers, HTTP/gRPC routes). The *build* is **feature-keyed** (one Feature = one FRD, 1:1) and lives under the placement mode (playbook §23):

- **Mode A** (sprint-bound): `sprints/sprint-NN/features/<feature-slug>/README.md`
- **Mode B** (epic-bound, default): `epics/<epic-id>-<slug>/features/<feature-slug>/README.md`
- **Mode C** (flat): `features/<feature-slug>/README.md`

There is **no `frds/` folder in the build** — the FRD *spec* stays here in `architecture/frds/`; the build is keyed by the feature slug. The feature `README.md` is its live trail (the FRD's Tasks pulled in as a `- [ ]` checklist); the **code is the Act** — there is no separate `act.md`.

## Template

Use the Templater snippet `.obsidian/templates/frd-template.md`. Sections: intent · inherited domain context · acceptance criteria · validation rules · **Tasks** (1–2 day units) · behavioral API surface · out-of-scope · open questions.

## Example index

| Slug | Functionality | SDD | Feature | Status |
|----|---------------|-----|---------|--------|
| frd-post-entry | <functionality> | sdd-ledger | <feature-slug> | draft |
