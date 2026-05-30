<%*
const id = await tp.system.prompt("Card ID (e.g. 001)");
const slug = await tp.system.prompt("Slug (kebab-case)");
const stage = await tp.system.prompt("Stage (backlog | roadmap)");
const kind = await tp.system.prompt("Kind (feature | refactor | infra | bug)", "feature");
const epic = await tp.system.prompt("Epic slug (e.g. 002-authentication, blank if none)", "");
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
---

# <% stage.toUpperCase() %>-<% id %> — <% slug.replace(/-/g, " ") %>

<!--
Kind semantics:
- feature  — delivers new user-visible value.
- refactor — internal quality improvement, no behavior change.
- infra    — CI/CD, observability, dev tooling.
- bug      — defect fix. May fast-track through `refining` if impact is declared.

The `epic:` field is optional; fill it when this card belongs to a known epic
(see `../epics/`). Leave blank for standalone work.
-->

## Why

<!-- One paragraph: motivation, problem, opportunity. -->

## Outcome / acceptance hint

- [ ]

## Notes / preliminary research

<!-- Free-form scratchpad. Becomes input to research.md when this card is promoted to a feature. -->

## Dependencies

<!-- Other cards, ADRs, external work that gates this. -->

## Estimated cost

<!-- T-shirt size: XS / S / M / L / XL — or hours, or sprints. -->
