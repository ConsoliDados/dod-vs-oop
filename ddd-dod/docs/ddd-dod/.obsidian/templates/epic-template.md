<%*
const id = await tp.system.prompt("Epic ID (e.g. 001)");
const slug = await tp.system.prompt("Epic slug (kebab-case)");
const type = await tp.system.prompt("Type (capability | refactor | infra)");
const owner = await tp.system.prompt("Owner (person / team)");
await tp.file.rename(`${id}-${slug}`);
await tp.file.move(`/epics/${id}-${slug}`);
const date = tp.date.now("YYYY-MM-DD");
-%>
---
id: EPIC-<% id %>
slug: <% slug %>
type: <% type %>
status: planned
owner: <% owner %>
sdd:
target_window:
roadmap_cards: []
sprints: []
related_decisions: []
exits_with: []
---

# EPIC-<% id %> — <% slug.replace(/-/g, " ") %>

<!--
Type semantics:
- capability — themed body of product work (e.g. "authentication", "billing").
- refactor  — quality / restructuring (e.g. "extract auth into its own crate").
- infra     — pipeline / observability / dev tools (e.g. "CI hardening").

(Temporal grouping — "bootstrap", "MVP", "v1" — is now a MILESTONE, not an epic type:
see `milestone-template.md`. A Milestone spans 1..N epics/SDDs, 1 : N.)

Epic *references* an SDD — it does not equal one (playbook §22.1; Epic : SDD ≈ 1 : 1).
A DOMAIN epic (`capability`) references exactly one bounded context — set `sdd:` to its
SDD ID (e.g. SDD-001); the SDD is the agnostic domain bible. A CROSS-CUTTING epic
(`refactor`, `infra`) references no bounded context — leave `sdd:` blank. The reference is
one-way: the epic points at the SDD; the SDD never points back.
-->

## Why

<!-- One paragraph: what problem this epic addresses, what motivates it now. -->

## Outcome

<!-- The observable end-state. Not "we will refactor" — "the X module is split into Y and Z, with no callers depending on the old shape". -->

## Scope (in)

- <!-- bullet -->

## Out of scope

- <!-- explicitly deferred -->

## Exits with

<!--
Critério formal de "done" deste epic. Quando todos checados → status: done →
release candidate (see playbook-base.md §16.4). Each item should be testable
or observable.
-->

- [ ]
- [ ]

## Related decisions

<!-- ADRs and SDDs created or significantly touched during this epic. Update as work progresses. -->

- ADR-NNNN — <title>
- SDD-NNN — <area>

## Risks / open questions

<!-- Cross-link to `open-questions.md`. Risks specific to this epic live here; cross-cutting concerns go in the global file. -->

## Progress log

<% date %> — Planned
