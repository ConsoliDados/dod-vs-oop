<%*
const slug = await tp.system.prompt("Feature slug (kebab-case) — 1:1 with its FRD");
const frd = await tp.system.prompt("FRD this feature realizes (e.g. frd-appointment)");
const buildDir = await tp.system.prompt("Feature build dir (sprints/sprint-01 | epics/002-scheduling | flat)");

let destDir;
let modeShort;
if (buildDir.startsWith("sprints/")) {
  destDir = `/${buildDir}/features/${slug}/README`;
  modeShort = "A";
} else if (buildDir === "flat") {
  destDir = `/features/${slug}/README`;
  modeShort = "C";
} else {
  destDir = `/${buildDir}/features/${slug}/README`;
  modeShort = "B";
}

await tp.file.rename(`README`);
await tp.file.move(destDir);
-%>
---
slug: <% slug %>
frd: <% frd %>
mode: <% modeShort %>
status: planned
depends-on: []
blocks: []
---

# Feature — <% slug.replace(/-/g, " ") %>

<!--
A Feature is the management realization of ONE FRD (1:1). Its build folder holds THIS README (the
live trail) and the code (the Act). There is NO `frds/` folder in the build and NO separate
`act.md` — the FRD spec lives in `architecture/frds/frd-<slug>.md`; the code is the Act; this
README carries the trail. RPA is mental discipline, not files; durable decisions go to an ADR.

The Tasks below are the FRD's Tasks (1–2 day units), pulled in as a checklist. Mode (playbook §23):
- A — sprint-bound → build dir under `sprints/sprint-NN/features/<slug>/`
- B — epic-bound (default) → build dir under `epics/<epic-id>-<slug>/features/<slug>/`
- C — flat → build dir is `flat`; feature lives at `/features/<slug>/`
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

`feat/<% slug %>` off `dev`.

## Notes / surprises

<!-- Inline log; punted items + why. Surface to open-questions.md if they affect the FRD/SDD. -->

## Retro

<!-- Filled at close. -->

**Shipped:**
**Punted:** → <backlog / next sprint / dropped>
**Surprises:**
**Carry forward:**
