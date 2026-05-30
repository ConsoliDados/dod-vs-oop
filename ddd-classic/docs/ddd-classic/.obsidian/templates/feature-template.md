<%*
const id = await tp.system.prompt("Feature ID (e.g. 001)");
const slug = await tp.system.prompt("Feature slug (kebab-case)");
const container = await tp.system.prompt("Container (sprint-NN | epic slug | 'flat')");

let destDir;
let modeShort;
if (container.startsWith("sprint-")) {
  destDir = `/sprints/${container}/features/${id}-${slug}/feature`;
  modeShort = "A";
} else if (container === "flat") {
  destDir = `/features/${id}-${slug}/feature`;
  modeShort = "C";
} else {
  destDir = `/epics/${container}/features/${id}-${slug}/feature`;
  modeShort = "B";
}

await tp.file.rename(`feature`);
await tp.file.move(destDir);
-%>
---
id: FEAT-<% id %>
slug: <% slug %>
container: <% container %>
mode: <% modeShort %>
status: planned
depends-on: []
blocks: []
---

# FEAT-<% id %> — <% slug.replace(/-/g, " ") %>

<!--
Mode reference (playbook.md §23):
- A — sprint-bound  → container is `sprint-NN`
- B — epic-bound    → container is the epic slug (e.g. `002-authentication`)
- C — flat          → container is `flat`; feature lives at `/features/<id>-<slug>/`
-->

## Goal

<!-- One paragraph. Why does this feature exist? What outcome does it produce? -->

## Acceptance criteria

<!-- Checkboxes. Each one is testable. -->

- [ ]
- [ ]

## Scope

**In:**

**Out:**

## RPA artefacts

- `research.md` — sources, prior art, decisions to surface
- `plan.md` — concrete plan; may produce ADRs or SDD updates
- `act.md` — live task tracker (checklist pulled from `plan.md`, checked off as work happens) + inline retro at the bottom

## Branch

`feat/<% slug %>` off `dev`.

## Open questions

<!-- Surface to open-questions.md if they affect the plan. -->
