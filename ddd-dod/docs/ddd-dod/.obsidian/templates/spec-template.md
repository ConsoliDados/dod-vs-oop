<%*
const id = await tp.system.prompt("Card ID (e.g. 001)");
const slug = await tp.system.prompt("Slug (kebab-case)");
const stage = await tp.system.prompt("Stage (backlog | roadmap)");
const kind = await tp.system.prompt("Kind (feature | refactor | infra | bug)", "feature");
const epic = await tp.system.prompt("Epic slug (e.g. 002-authentication, blank if none)", "");
const frd = await tp.system.prompt("FRD id this card realizes (e.g. FRD-001, blank if none)", "");
const sdd = await tp.system.prompt("SDD id / bounded context (e.g. SDD-001, blank if none)", "");
await tp.file.rename(`${id}-${slug}`);
await tp.file.move(`/${stage}s/${id}-${slug}`);
-%>
---
id: <% stage.toUpperCase() %>-<% id %>
slug: <% slug %>
stage: <% stage %>
kind: <% kind %>
status: initial
epic: <% epic %>
frd: <% frd %>
sdd: <% sdd %>
---

# <% stage.toUpperCase() %>-<% id %> — <% slug.replace(/-/g, " ") %>

<!--
Kind semantics:
- feature  — delivers new user-visible value.
- refactor — internal quality improvement, no behavior change.
- infra    — CI/CD, observability, dev tooling.
- bug      — defect fix. May fast-track through `refining` if impact is declared.

This card is MANAGEMENT; the link fields are one-way refs INTO the agnostic docs (the docs
never point back — playbook §22.1). The `epic:` field is optional; fill it when this card
belongs to a known epic (see `../epics/`). Leave blank for standalone work. `frd:` / `sdd:`
are also optional — fill them when the card realizes a specific FRD (1:1 with a Feature) /
domain (medium+), so the board links back to the spec it delivers. Leave blank otherwise.
-->

## Why

<!-- One paragraph: motivation, problem, opportunity. -->

## Outcome / acceptance hint

- [ ]

## Notes / preliminary research

<!-- Free-form scratchpad. Feeds the SDD/FRD authoring (mental RPA) when this card is picked up;
durable decisions become ADRs. No research.md by default. -->

## Dependencies

<!-- Other cards, ADRs, external work that gates this. -->

## Estimated cost

<!-- T-shirt size: XS / S / M / L / XL — or hours, or sprints. -->
