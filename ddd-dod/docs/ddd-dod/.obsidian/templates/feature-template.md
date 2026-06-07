<%*
const num = await tp.system.prompt("Feature card number (NNN, e.g. 007)");
const slug = await tp.system.prompt("Feature slug (kebab-case) — 1:1 with its FRD");
const frd = await tp.system.prompt("FRD slug this feature realizes (e.g. account-balance; blank if absorbed in the SDD)", "");
const epic = await tp.system.prompt("Epic it belongs to (e.g. EPIC-002 or 002-active-foundation; blank if none)", "");
await tp.file.rename(`${num}-${slug}`);
await tp.file.move(`/roadmap/03-features/${num}-${slug}`);
-%>
---
feature: <% slug %>
frd: <% frd %>
epic: <% epic %>
status: todo
depends-on: []
blocks: []
---

# Feature — <% slug.replace(/-/g, " ") %> (FEAT-<% num %>)

<!--
A Feature is the management realization of ONE FRD (1:1). THIS card (in `roadmap/03-features/`) is the
live trail; the CODE is the Act in the source tree. Containment is by REFERENCE — `frd:` (the spec, in
`architecture/frds/frd-<slug>.md`, or absorbed in the owning SDD's §8 "Functionalities") and `epic:` —
NOT folder nesting. Identity of the FRD is its slug (no `FRD-NNN`); this card keeps a management number
(FEAT-NNN) because the board/Jira hands those out. There is no `act.md`; RPA is mental discipline;
durable decisions go to an ADR.

Mode (playbook §23) is the OPTIONAL sprint overlay: by default (Mode B/C) the card just flows through
its epic; under Mode A you additionally list it in the active `sprints/sprint-NN/README.md`.
-->

## Goal

<!-- One sentence: what this feature delivers (= the FRD's intent). -->

## Acceptance (from the FRD)

<!-- The FRD's acceptance criteria / validation rules this feature satisfies. Each testable. -->

- [ ]

## Tasks (the FRD's Tasks)

<!-- Pulled from the FRD's §5. The 1–2 day units, built bottom-up & layered. Checked off as work
happens; internal hour-level steps can nest under each. -->

- [ ]

## Branch

`feat/<% num %>-<% slug %>` → merged locally into its epic branch (playbook §16.2).

## Notes / surprises

<!-- Inline log; punted items + why. Surface to open-questions.md if they affect the FRD/SDD. -->

## Retro

<!-- Filled at close. -->

**Shipped:**
**Punted:** → <backlog / next iteration / dropped>
**Surprises:**
**Carry forward:**
