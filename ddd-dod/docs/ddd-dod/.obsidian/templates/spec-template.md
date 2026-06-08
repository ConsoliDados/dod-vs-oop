<%*
const id = await tp.system.prompt("Backlog ID (e.g. 001)");
const slug = await tp.system.prompt("Slug (kebab-case)");
const kind = await tp.system.prompt("Kind (feature | refactor | infra | bug)", "feature");
await tp.file.rename(`${id}-${slug}`);
await tp.file.move(`/backlogs/${id}-${slug}`);
-%>
---
id: BACKLOG-<% id %>
slug: <% slug %>
kind: <% kind %>
status: initial
---

# BACKLOG-<% id %> — <% slug.replace(/-/g, " ") %>

<!--
A BACKLOG card is an IDEA not yet committed (distinct from the roadmap, which is committed work — the
production pipeline). Kind: feature (new user-visible value) · refactor (internal quality, no behavior
change) · infra (CI/CD, observability, tooling) · bug (defect fix).

When the work is DECIDED, PROMOTE it to the roadmap (§6.2): create the matching card with the dedicated
Templater snippet for its level — `milestone-template` / `epic-template` / `feature-template`. The
feature card lands ref-based at `roadmap/03-features/<NNN>-<slug>.md` and carries the one-way
`epic:` / `frd:` refs (FRD/SDD by slug). The board/Jira hands out the management number.
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

<!-- T-shirt size: XS / S / M / L / XL — or hours. -->
